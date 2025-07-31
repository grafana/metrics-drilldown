import { LoadingState, type AdHocVariableFilter, type DataFrame } from '@grafana/data';
import { sceneGraph, SceneQueryRunner, type CancelActivationHandler, type SceneObject } from '@grafana/scenes';
import { parser } from '@prometheus-io/lezer-promql';

import { processLabelMatcher } from 'extensions/links';

import { VAR_FILTERS_EXPR, VAR_METRIC_EXPR } from '../../shared';
import { logger } from '../../tracking/logger/logger';
import { buildPrometheusQuery } from '../buildPrometheusQuery';

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
export function extremeValueFilterBehavior(panel: SceneObject): CancelActivationHandler | void {
  const [queryRunner] = sceneGraph.findDescendents(panel, SceneQueryRunner);

  if (!queryRunner) {
    logger.warn('ExtremeValueFilterBehavior: No query runner found for viz panel');
    return;
  }

  // When the query runner's state changes, check if the data is all NaN.
  // If it is, remove the extreme values from the query.
  const queryRunnerSub = queryRunner.subscribeToState((state) => {
    if (state.data?.state === LoadingState.Done && state.data?.series) {
      const series = state.data.series;
      if (isAllDataNaN(series)) {
        logger.info(
          'ExtremeValueFilterBehavior: Detected all NaN values, attempting to filter extreme values from query',
          sceneGraph.interpolate(queryRunner, queryRunner.state.queries[0].expr)
        );
        removeExtremeValues(queryRunner, panel);
      }
    }
  });

  // Return cleanup function
  return () => queryRunnerSub.unsubscribe();
}

/**
 * Checks if all data in the series contains only NaN values
 */
function isAllDataNaN(series: DataFrame[]): boolean {
  return series.every((frame) => isDataFrameAllNaN(frame));
}

/**
 * Checks if all the values in the DataFrame are NaN
 */
function isDataFrameAllNaN(frame: DataFrame): boolean {
  const valuesField = frame.fields.find((field) => field.name === 'Value');

  if (!valuesField) {
    return false;
  }

  return valuesField.values.every((value: unknown) => Number.isNaN(value));
}

/**
 * Re-run the query with extreme value filtering enabled
 */
function removeExtremeValues(queryRunner: SceneQueryRunner, panel: SceneObject) {
  const queries = queryRunner.state.queries;
  if (!queries || queries.length === 0) {
    logger.warn('ExtremeValueFilterBehavior: No queries found in query runner');
    return;
  }

  // Parse the original query to extract the metric, filters, groupings, etc.
  const queryParts = parseQueryForRebuild(queries[0].expr, queryRunner);

  if (!queryParts) {
    logger.warn('ExtremeValueFilterBehavior: Could not parse query for rebuilding');
    return;
  }

  // Rebuild the query with extreme value filtering
  const filteredQuery = buildPrometheusQuery({
    ...queryParts,
    filterExtremeValues: true,
  });

  logger.log('ExtremeValueFilterBehavior: Re-running query with extreme value filtering:', filteredQuery);

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
  });

  newQueryRunner.runQueries();
}

/**
 * Parses a PromQL query to extract parameters for rebuilding with filtering
 */
export function parseQueryForRebuild(query: string, queryRunner: SceneQueryRunner) {
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
    let nonRateQueryFunction: string | undefined;

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
          } else if (['avg', 'sum', 'min', 'max', 'count'].includes(functionName)) {
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
      return null;
    }

    return {
      metric,
      filters: labels,
      isRateQuery,
      groupings,
      nonRateQueryFunction: nonRateQueryFunction as any,
    };
  } catch (error) {
    let errorObject: Error;

    if (!(error instanceof Error)) {
      errorObject = new Error('ExtremeValueFilterBehavior: Error parsing query');
    } else {
      errorObject = error;
    }

    logger.error(errorObject);
    return null;
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
