import { css } from '@emotion/css';
import { LoadingState, type AdHocVariableFilter, type DataFrame, type Field, type GrafanaTheme2 } from '@grafana/data';
import { sceneGraph, SceneQueryRunner, type CancelActivationHandler, type VizPanel } from '@grafana/scenes';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { parser } from '@prometheus-io/lezer-promql';
import React from 'react';

import { processLabelMatcher } from 'extensions/links';
import { reportExploreMetrics } from 'interactions';

import { VAR_FILTERS_EXPR, VAR_METRIC_EXPR } from '../../shared';
import { logger } from '../../tracking/logger/logger';
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

  // Prevent double-unsubscribing, by tracking if the subscription has been unsubscribed already.
  // Without this, double-unsubscribing can happen due to the query runner being cloned and updated in `removeExtremeValues`.
  let isUnsubscribed = false;

  // When the query runner's state changes, check if the data is all NaN.
  // If it is, remove the extreme values from the query.
  const queryRunnerSub = queryRunner?.subscribeToState((state) => {
    // Don't process if already unsubscribed
    if (isUnsubscribed) {
      return;
    }

    if (state.data?.state === LoadingState.Done && state.data?.series) {
      const { series } = state.data;

      if (series.length === 0 || !isAllDataNaN(series)) {
        return;
      }

      reportExploreMetrics('extreme_value_filter_behavior_triggered', {
        expression: sceneGraph.interpolate(queryRunner, queryRunner.state.queries[0].expr),
      });
      const extremeValueRemoval = removeExtremeValues(queryRunner, panel);

      if (!extremeValueRemoval.success) {
        logger.warn('ExtremeValueFilterBehavior: Failed to remove extreme values:', extremeValueRemoval.issue);
      }
    }
  });

  // Return cleanup function
  return () => {
    if (!isUnsubscribed && queryRunnerSub) {
      isUnsubscribed = true;
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

interface RemoveExtremeValuesMeta {
  success: boolean;
  issue?: string;
}

/**
 * Re-run the query with extreme value filtering enabled
 */
function removeExtremeValues(queryRunner: SceneQueryRunner, panel: VizPanel): RemoveExtremeValuesMeta {
  const queries = queryRunner.state.queries;
  if (!queries || queries.length === 0) {
    return { success: false, issue: 'No queries found in query runner' };
  }

  // Parse the original query to extract the metric, filters, groupings, etc.
  const queryParsing = parseQueryForRebuild(queries[0].expr, queryRunner);

  if (!queryParsing.success) {
    return { success: false, issue: queryParsing.error.message };
  }

  // Rebuild the query with extreme value filtering
  const filteredQuery = buildPrometheusQuery({
    ...queryParsing.queryParts,
    filterExtremeValues: true,
  });

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
    titleItems: <VizPanelExtremeValuesWarning />,
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

type ParseQueryForRebuildResult = { success: true; queryParts: QueryParts } | { success: false; error: Error };

/**
 * Parses a PromQL query to extract parameters for rebuilding with filtering
 */
export function parseQueryForRebuild(query: string, queryRunner: SceneQueryRunner): ParseQueryForRebuildResult {
  try {
    let queryExpression = query;
    const hasTemplateVariables = query.includes(VAR_METRIC_EXPR) || query.includes(VAR_FILTERS_EXPR);

    if (hasTemplateVariables) {
      queryExpression = sceneGraph.interpolate(queryRunner, query);
    }

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
      return { success: false, error: new Error('ExtremeValueFilterBehavior: No metric found in query') };
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
      error: error instanceof Error ? error : new Error('ExtremeValueFilterBehavior: Error parsing query'),
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

function VizPanelExtremeValuesWarning() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.extremeValuedisclaimer}>
      <Tooltip content="Panel data was re-fetched with a more complex query to handle extremely small values in the series">
        <span className={styles.warningMessage}>
          <Icon name="exclamation-triangle" aria-hidden="true" />
        </span>
      </Tooltip>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
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
    color: theme.colors.warning.main,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
