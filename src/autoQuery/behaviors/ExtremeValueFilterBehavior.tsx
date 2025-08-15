import { css } from '@emotion/css';
import { LoadingState, type AdHocVariableFilter, type DataFrame, type Field, type GrafanaTheme2 } from '@grafana/data';
import { sceneGraph, SceneQueryRunner, type CancelActivationHandler, type VizPanel } from '@grafana/scenes';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { parser } from '@prometheus-io/lezer-promql';
import React from 'react';
import { type Unsubscribable } from 'rxjs';

import { reportExploreMetrics } from 'interactions';

import { VAR_FILTERS_EXPR, VAR_METRIC_EXPR } from '../../shared';
import { logger } from '../../tracking/logger/logger';
import { processLabelMatcher } from '../../utils/utils.promql';
import { buildPrometheusQuery, isNonRateQueryFunction, type NonRateQueryFunction } from '../buildPrometheusQuery';

/**
 * A stateless function that detects when all data in a query result is NaN
 * and attempts to re-run the query with extreme value filtering.
 *
 * This addresses the issue where Prometheus metrics with extremely small values
 * (e.g., 9e-129) cause arithmetic operations during averaging to underflow
 * or become undefined, resulting in NaN for queries like `avg(some_metric_with_extreme_values)`.
 *
 * @remarks
 * Implementing this as a behavior allows us to apply the extreme values filtering
 * to only the queries that are affected by the extreme values, rather than all queries in the scene.
 * That way, we can keep queries simpler by default, and only apply the extreme values filtering
 * when it's necessary.
 */
export function extremeValueFilterBehavior(panel: VizPanel): CancelActivationHandler | void {
  const [queryRunner] = sceneGraph.findDescendents(panel, SceneQueryRunner);

  // When the query runner's state changes, check if the data is all NaN.
  // If it is, remove the extreme values from the query.
  const queryRunnerSub = queryRunner?.subscribeToState((state) => {
    if (state.data?.state === LoadingState.Done && state.data?.series) {
      const { series } = state.data;

      if (series.length === 0 || !isAllDataNaN(series)) {
        return;
      }

      reportExploreMetrics('extreme_value_filter_behavior_triggered', {
        expression: sceneGraph.interpolate(queryRunner, queryRunner.state.queries[0].expr),
      });
      const extremeValueRemoval = removeExtremeValues(queryRunner, panel, queryRunnerSub);

      if (!extremeValueRemoval.success) {
        panel.setState({
          titleItems: (
            <VizPanelExtremeValuesMessage
              level="warning"
              message="Extreme values detected, but could not re-run the query with extreme value filtering"
            />
          ),
        });
        logger.warn('ExtremeValueFilterBehavior: Failed to remove extreme values:', extremeValueRemoval.issue);
      }
    }
  });

  // Return cleanup function
  return () => {
    if (queryRunnerSub) {
      queryRunnerSub.unsubscribe();
    }
  };
}

/**
 * Checks if all data in the series contains only NaN values,
 * short-circuiting if any frame contains non-NaN values.
 */
function isAllDataNaN(series: DataFrame[]): boolean {
  return series.every((frame) => isDataFrameAllNaN(frame));
}

interface FieldWithEntitiesNaN extends Field<any> {
  entities: {
    NaN: number[];
  };
}

function isFieldWithEntitiesNaN(field: Field): field is FieldWithEntitiesNaN {
  return 'entities' in field && Array.isArray((field as FieldWithEntitiesNaN).entities?.NaN);
}

/**
 * Checks if all the values in the DataFrame are NaN
 */
function isDataFrameAllNaN(frame: DataFrame): boolean {
  const valuesField = frame.fields.find((field) => field.name === 'Value');

  if (!valuesField || !isFieldWithEntitiesNaN(valuesField)) {
    return false;
  }

  return valuesField.entities.NaN.length === frame.length;
}

type RemoveExtremeValuesMeta = { success: true } | { success: false; issue: string };

/**
 * Re-run the query with extreme value filtering enabled
 */
function removeExtremeValues(
  queryRunner: SceneQueryRunner,
  panel: VizPanel,
  queryRunnerSub: Unsubscribable
): RemoveExtremeValuesMeta {
  const queries = queryRunner.state.queries;
  if (!queries || queries.length === 0) {
    return { success: false, issue: 'No queries found in query runner' };
  }

  // Parse the original query to extract the metric, filters, groupings, etc.
  const queryParsing = parseQueryForRebuild(queries[0].expr, queryRunner);

  if (!queryParsing.success) {
    return { success: false, issue: queryParsing.issue };
  }

  // Rebuild the query with extreme value filtering
  const filteredQuery = buildPrometheusQuery({
    ...queryParsing.queryParts,
    filterExtremeValues: true,
  });

  // Unsubscribe from the original query runner before replacing it
  if (queryRunnerSub) {
    queryRunnerSub.unsubscribe();
  }

  // Create a new query runner with the filtered query
  const newQueryRunner = queryRunner.clone({
    queries: [
      {
        ...queries[0],
        expr: filteredQuery,
      },
    ],
  });

  panel.setState({
    $data: newQueryRunner,
    titleItems: (
      <VizPanelExtremeValuesMessage
        level="info"
        message="Panel data was re-fetched with a more complex query to handle extremely small values in the series"
      />
    ),
  });

  newQueryRunner.runQueries();

  return { success: true };
}

interface QueryParts {
  metric: string;
  filters: AdHocVariableFilter[];
  isRateQuery: boolean;
  nonRateQueryFunction?: NonRateQueryFunction;
  groupings?: string[];
}

type ParseQueryForRebuildResult = { success: true; queryParts: QueryParts } | { success: false; issue: string };

/**
 * Parses a PromQL query to extract parameters for rebuilding with filtering
 */
export function parseQueryForRebuild(query: string, queryRunner: SceneQueryRunner): ParseQueryForRebuildResult {
  let queryExpression = query;
  const hasTemplateVariables = query.includes(VAR_METRIC_EXPR) || query.includes(VAR_FILTERS_EXPR);

  if (hasTemplateVariables) {
    queryExpression = sceneGraph.interpolate(queryRunner, query);
  }

  try {
    const tree = parser.parse(queryExpression);
    let metric = '';
    const labels: AdHocVariableFilter[] = [];
    let isRateQuery = false;
    let groupings: string[] | undefined;
    let nonRateQueryFunction: NonRateQueryFunction | undefined;

    // Use tree.iterate() for simpler traversal
    tree.iterate({
      enter: (node) => {
        // Check for rate function
        if (node.name === 'FunctionCall') {
          // Find the function name (first child should be the identifier)
          let functionName = '';
          for (let child = node.node.firstChild; child; child = child.nextSibling) {
            if (child.type.name === 'Identifier') {
              functionName = queryExpression.slice(child.from, child.to);
              break;
            }
          }

          if (functionName === 'rate') {
            isRateQuery = true;
          } else if (isNonRateQueryFunction(functionName)) {
            nonRateQueryFunction = functionName;
            isRateQuery = false;
          }
        }

        // Get the first metric name from any VectorSelector > Identifier
        if (!metric && node.name === 'Identifier' && node.node.parent?.type.name === 'VectorSelector') {
          metric = queryExpression.slice(node.from, node.to);
        }

        // Extract label matchers
        const labelData = processLabelMatcher(node, queryExpression);
        if (labelData) {
          labels.push({
            key: labelData.label,
            operator: labelData.op,
            value: labelData.value,
          });
        }

        // Extract groupings from by clause
        if (node.name === 'GroupingLabels' && nonRateQueryFunction) {
          groupings = extractGroupings(node, queryExpression);
        }
      },
    });

    if (!metric) {
      return {
        success: false,
        issue: `Could not parse the metric name from the query: ${queryExpression}`,
      };
    }

    return {
      success: true,
      queryParts: {
        metric,
        filters: labels,
        isRateQuery,
        groupings,
        nonRateQueryFunction,
      },
    };
  } catch (error) {
    return {
      success: false,
      issue: `Unexpected error during query parsing to handle extreme values: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Extracts groupings from a GroupingLabels node
 */
function extractGroupings(node: any, expr: string): string[] {
  const groupings: string[] = [];

  // Traverse children to find LabelName nodes
  for (let child = node.node.firstChild; child; child = child.nextSibling) {
    if (child.type.name === 'LabelName') {
      const grouping = expr.slice(child.from, child.to);
      if (grouping) {
        groupings.push(grouping);
      }
    }
  }

  return groupings;
}

interface VizPanelExtremeValuesMessageProps {
  message: string;
  level: 'warning' | 'info';
}

function VizPanelExtremeValuesMessage({ message, level }: Readonly<VizPanelExtremeValuesMessageProps>) {
  const styles = useStyles2(getStyles, level);

  return (
    <div className={styles.extremeValuedisclaimer}>
      <Tooltip content={message}>
        <span className={styles.warningMessage}>
          <Icon name={level === 'warning' ? 'exclamation-triangle' : 'info-circle'} aria-hidden="true" />
        </span>
      </Tooltip>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, level: 'warning' | 'info') => ({
  extremeValuedisclaimer: css({
    label: 'extreme-value-disclaimer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  warningMessage: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: level === 'warning' ? theme.colors.warning.main : theme.colors.info.main,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
