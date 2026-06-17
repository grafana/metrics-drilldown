import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { isRangeVectorFunction, PROMQL_FUNCTIONS, type PrometheusFunction } from 'shared/GmdVizPanel/config/promql-functions';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { type QueryConfig, type QueryDefs } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';
import { logger } from 'shared/logger/logger';

import { type GetQueryRunnerParamsOptions, type QueryRunnerParams } from '../panelBuilder';

export function getStatQueryRunnerParams(options: GetQueryRunnerParamsOptions): QueryRunnerParams {
  const { metric, queryConfig } = options;
  const isRateQuery = metric.type === 'counter';
  const expression = buildQueryExpression({
    metric,
    labelMatchers: queryConfig.labelMatchers,
    addIgnoreUsageFilter: queryConfig.addIgnoreUsageFilter,
    addExtremeValuesFiltering: queryConfig.addExtremeValuesFiltering,
  });

  const interval = queryConfig.customRateInterval ?? '$__rate_interval';
  const expr = isRateQuery ? promql.rate({ expr: expression, interval }) : expression;

  return {
    isRateQuery,
    maxDataPoints: queryConfig.resolution === QUERY_RESOLUTION.HIGH ? 500 : 250,
    queries: buildQueriesWithPresetFunctions({ metric, queryConfig, isRateQuery, expr }),
  };
}

// KG-supplied customFunction workaround (issue #1131). Range-vector functions need `[interval]`;
// see isRangeVectorFunction for the detection rationale. Any function name is emitted verbatim.
function buildCustomFunctionQuery(
  metricName: string,
  customFn: string,
  expr: string,
  interval: string,
  isRateQuery: boolean
): SceneDataQuery {
  const isRange = isRangeVectorFunction(customFn);
  const queryExpr = isRange ? `${customFn}(${expr}[${interval}])` : `${customFn}(${expr})`;
  const fnName = isRateQuery ? `${customFn}(rate)` : customFn;
  return {
    refId: `${metricName}-${fnName}`,
    expr: queryExpr,
    legendFormat: fnName,
    fromExploreMetrics: true,
  };
}

// Preset-function path: looks up the fn in PROMQL_FUNCTIONS and applies it. Returns undefined
// and logs a warn if the fn is not registered.
function buildPresetFunctionQuery(
  metricName: string,
  fn: PrometheusFunction,
  expr: string,
  interval: string,
  isRateQuery: boolean
): SceneDataQuery | undefined {
  const entry = PROMQL_FUNCTIONS.get(fn);
  if (!entry) {
    logger.warn(`[getStatQueryRunnerParams] Unknown PromQL function "${fn}", skipping query.`);
    return undefined;
  }
  const isRangeFn = isRangeVectorFunction(entry.name);
  const query = isRangeFn ? entry.fn({ expr, interval }) : entry.fn({ expr });
  const fnName = isRateQuery ? `${entry.name}(rate)` : entry.name;
  return {
    refId: `${metricName}-${fnName}`,
    expr: query,
    legendFormat: fnName,
    fromExploreMetrics: true,
  };
}

// here we support preset functions
function buildQueriesWithPresetFunctions({
  metric,
  queryConfig,
  isRateQuery,
  expr,
}: {
  metric: Metric;
  queryConfig: QueryConfig;
  isRateQuery: boolean;
  expr: string;
}): SceneDataQuery[] {
  const defaultPromqlFn = isRateQuery ? 'sum' : 'avg';
  const interval = queryConfig.customRateInterval ?? '$__rate_interval';
  const customFn = queryConfig.customFunction;

  if (customFn) {
    return [buildCustomFunctionQuery(metric.name, customFn, expr, interval, isRateQuery)];
  }

  const queryDefs: QueryDefs = queryConfig.queries?.length ? queryConfig.queries : [{ fn: defaultPromqlFn }];
  const queries: SceneDataQuery[] = [];
  for (const { fn } of queryDefs) {
    const q = buildPresetFunctionQuery(metric.name, fn, expr, interval, isRateQuery);
    if (q) {
      queries.push(q);
    }
  }

  return queries;
}
