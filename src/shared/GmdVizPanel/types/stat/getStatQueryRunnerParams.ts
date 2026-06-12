import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { PROMQL_FUNCTIONS, type PrometheusFunction } from 'shared/GmdVizPanel/config/promql-functions';
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

// KG-supplied customFunction (issue #1131) wins over the localStorage queryConfig.queries
// pref and over the type-driven default. URL is authoritative. Whitelist mirrors timeseries.
const CUSTOM_FUNCTION_WHITELIST = new Set<PrometheusFunction>([
  'avg',
  'sum',
  'min',
  'max',
  'count',
  'max_over_time',
  'min_over_time',
]);

function resolveQueryDefs(
  customFn: PrometheusFunction | undefined,
  queries: QueryDefs | undefined,
  defaultFn: PrometheusFunction
): QueryDefs {
  if (customFn && CUSTOM_FUNCTION_WHITELIST.has(customFn)) {
    return [{ fn: customFn }];
  }
  if (queries?.length) {
    return queries;
  }
  return [{ fn: defaultFn }];
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
  const customFn = queryConfig.customFunction as PrometheusFunction | undefined;
  const queryDefs = resolveQueryDefs(customFn, queryConfig.queries, defaultPromqlFn);

  const interval = queryConfig.customRateInterval ?? '$__rate_interval';
  const queries: SceneDataQuery[] = [];

  for (const { fn } of queryDefs) {
    const entry = PROMQL_FUNCTIONS.get(fn);
    if (!entry) {
      logger.warn(`[getStatQueryRunnerParams] Unknown PromQL function "${fn}", skipping query.`);
      continue;
    }
    const isRangeFn = entry.name === 'max_over_time' || entry.name === 'min_over_time';
    const query = isRangeFn ? entry.fn({ expr, interval }) : entry.fn({ expr });
    const fnName = isRateQuery ? `${entry.name}(rate)` : entry.name;

    queries.push({
      refId: `${metric.name}-${fnName}`,
      expr: query,
      legendFormat: fnName,
      fromExploreMetrics: true,
    });
  }

  return queries;
}
