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
  let fn: PrometheusFunction = 'avg';
  if (metric.type === 'counter') {
    fn = 'sum';
  } else if (metric.type === 'info') {
    fn = 'count';
  }

  // KG-supplied customFunction (issue #1131) wins over the type default for instant aggregations.
  // The group-by path calls `promql[fn]({expr, by})` directly on tsqtsq, so the override is only
  // honored for instant aggregations that tsqtsq exposes and that accept a `by` clause. Range-vector
  // functions and custom-shaped entries (histogram_quantile, time-*) fall back to the type default
  // in group-by mode.
  const GROUP_BY_SAFE_FUNCTIONS = new Set<PrometheusFunction>(['avg', 'sum', 'min', 'max', 'count']);
  const customFn = queryConfig.customFunction as PrometheusFunction | undefined;
  if (customFn && GROUP_BY_SAFE_FUNCTIONS.has(customFn)) {
    fn = customFn;
  }

  const groupByLabel = utf8Support(queryConfig.groupBy as string);

  return [
    {
      refId: `${metric.name}-by-${queryConfig.groupBy}`,
      expr: promql[fn]({ expr, by: [groupByLabel] }),
      legendFormat: `{{${groupByLabel}}}`,
      fromExploreMetrics: true,
    },
  ];
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

  // KG-supplied customFunction (issue #1131) wins over the localStorage queryConfig.queries
  // pref and over the type-driven default. URL is authoritative. The whitelist is the v1
  // accepted KG values; custom-shaped entries (histogram_quantile, time-*) are kept out.
  const CUSTOM_FUNCTION_WHITELIST = new Set<PrometheusFunction>([
    'avg',
    'sum',
    'min',
    'max',
    'count',
    'max_over_time',
    'min_over_time',
  ]);
  const customFn = queryConfig.customFunction as PrometheusFunction | undefined;
  const queryDefs: QueryDefs =
    customFn && CUSTOM_FUNCTION_WHITELIST.has(customFn)
      ? [{ fn: customFn }]
      : queryConfig.queries?.length
        ? queryConfig.queries
        : [{ fn: defaultPromqlFn }];

  const interval = queryConfig.customRateInterval ?? '$__rate_interval';
  const queries: SceneDataQuery[] = [];

  for (const { fn } of queryDefs) {
    const entry = PROMQL_FUNCTIONS.get(fn);
    if (!entry) {
      logger.warn(`[getTimeseriesQueryRunnerParams] Unknown PromQL function "${fn}", skipping query.`);
      continue;
    }
    const isRangeFn = entry.name === 'max_over_time' || entry.name === 'min_over_time';
    const query = isRangeFn ? entry.fn({ expr, interval }) : entry.fn({ expr });
    const fnName = metric.type === 'counter' ? `${entry.name}(rate)` : entry.name;

    queries.push({
      refId: `${metric.name}-${fnName}`,
      expr: query,
      legendFormat: fnName,
      fromExploreMetrics: true,
    });
  }

  return queries;
}
