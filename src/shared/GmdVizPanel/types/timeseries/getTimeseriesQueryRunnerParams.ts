import { utf8Support } from '@grafana/prometheus';
import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { PROMQL_FUNCTIONS, type PrometheusFunction } from 'shared/GmdVizPanel/config/promql-functions';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { type QueryConfig, type QueryDefs } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';
import { logger } from 'shared/logger/logger';

import { type GetQueryRunnerParamsOptions, type QueryRunnerParams } from '../panelBuilder';

export function getTimeseriesQueryRunnerParams(options: GetQueryRunnerParamsOptions): QueryRunnerParams {
  const { metric, queryConfig } = options;
  const expression = buildQueryExpression({
    metric,
    labelMatchers: queryConfig.labelMatchers,
    addIgnoreUsageFilter: queryConfig.addIgnoreUsageFilter,
    addExtremeValuesFiltering: queryConfig.addExtremeValuesFiltering,
  });

  const isRateQuery = metric.type === 'counter';
  const interval = queryConfig.customRateInterval ?? '$__rate_interval';
  const expr = isRateQuery ? promql.rate({ expr: expression, interval }) : expression;

  return {
    isRateQuery,
    maxDataPoints: queryConfig.resolution === QUERY_RESOLUTION.HIGH ? 500 : 250,
    queries: queryConfig.groupBy
      ? buildGroupByQueries({ metric, queryConfig, expr })
      : buildQueriesWithPresetFunctions({ metric, queryConfig, expr }),
  };
}

// if grouped by, we don't provide support for preset functions
function buildGroupByQueries({
  metric,
  queryConfig,
  expr,
}: {
  metric: Metric;
  queryConfig: QueryConfig;
  expr: string;
}): SceneDataQuery[] {
  let typeDefault: PrometheusFunction = 'avg';
  if (metric.type === 'counter') {
    typeDefault = 'sum';
  } else if (metric.type === 'info') {
    typeDefault = 'count';
  }

  const customFn = queryConfig.customFunction;
  const groupByLabel = utf8Support(queryConfig.groupBy as string);
  const interval = queryConfig.customRateInterval ?? '$__rate_interval';

  let queryExpr: string;
  if (customFn) {
    // KG-supplied customFunction workaround (issue #1131). Some PromQL functions take a range
    // vector and require `[interval]`; the canonical list lives in Prometheus's parser table at
    // https://github.com/prometheus/prometheus/blob/main/promql/parser/functions.go (entries
    // whose ArgTypes include ValueTypeMatrix). We do not vendor that list; instead we match on
    // the `_over_time` suffix, the Prometheus naming convention for the range-vector aggregation
    // family. PromQL grammar does not let `by` attach to `fn(metric[interval])`, so range
    // functions are wrapped in the type-default instant aggregation. KG owns picking a function
    // that fits the call shape; any function name is emitted verbatim.
    const isRange = customFn.endsWith('_over_time');
    queryExpr = isRange
      ? `${typeDefault} by (${groupByLabel}) (${customFn}(${expr}[${interval}]))`
      : `${customFn} by (${groupByLabel}) (${expr})`;
  } else {
    const entry = PROMQL_FUNCTIONS.get(typeDefault);
    if (!entry) {
      logger.warn(`[getTimeseriesQueryRunnerParams] Unknown PromQL function "${typeDefault}" in group-by path, skipping query.`);
      return [];
    }
    queryExpr = entry.fn({ expr, by: [groupByLabel] });
  }

  return [
    {
      refId: `${metric.name}-by-${queryConfig.groupBy}`,
      expr: queryExpr,
      legendFormat: `{{${groupByLabel}}}`,
      fromExploreMetrics: true,
    },
  ];
}

// KG-supplied customFunction workaround (issue #1131). Some PromQL functions take a range
// vector and require `[interval]`; the canonical list lives in Prometheus's parser table at
// https://github.com/prometheus/prometheus/blob/main/promql/parser/functions.go (entries
// whose ArgTypes include ValueTypeMatrix). We do not vendor that list; instead we match on
// the `_over_time` suffix, the Prometheus naming convention for the range-vector aggregation
// family. KG owns picking a function that fits the call shape; any function name is emitted
// verbatim.
function buildCustomFunctionQuery(
  metricName: string,
  customFn: string,
  expr: string,
  interval: string,
  isCounter: boolean
): SceneDataQuery {
  const isRange = customFn.endsWith('_over_time');
  const queryExpr = isRange ? `${customFn}(${expr}[${interval}])` : `${customFn}(${expr})`;
  const fnName = isCounter ? `${customFn}(rate)` : customFn;
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
  isCounter: boolean
): SceneDataQuery | undefined {
  const entry = PROMQL_FUNCTIONS.get(fn);
  if (!entry) {
    logger.warn(`[getTimeseriesQueryRunnerParams] Unknown PromQL function "${fn}", skipping query.`);
    return undefined;
  }
  const isRangeFn = entry.name.endsWith('_over_time');
  const query = isRangeFn ? entry.fn({ expr, interval }) : entry.fn({ expr });
  const fnName = isCounter ? `${entry.name}(rate)` : entry.name;
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
  expr,
}: {
  metric: Metric;
  queryConfig: QueryConfig;
  expr: string;
}): SceneDataQuery[] {
  let defaultPromqlFn: PrometheusFunction = 'avg';
  if (metric.type === 'counter') {
    defaultPromqlFn = 'sum';
  } else if (metric.type === 'info') {
    defaultPromqlFn = 'count';
  }

  const interval = queryConfig.customRateInterval ?? '$__rate_interval';
  const isCounter = metric.type === 'counter';
  const customFn = queryConfig.customFunction;

  if (customFn) {
    return [buildCustomFunctionQuery(metric.name, customFn, expr, interval, isCounter)];
  }

  const queryDefs: QueryDefs = queryConfig.queries?.length ? queryConfig.queries : [{ fn: defaultPromqlFn }];
  const queries: SceneDataQuery[] = [];
  for (const { fn } of queryDefs) {
    const q = buildPresetFunctionQuery(metric.name, fn, expr, interval, isCounter);
    if (q) {
      queries.push(q);
    }
  }
  return queries;
}
