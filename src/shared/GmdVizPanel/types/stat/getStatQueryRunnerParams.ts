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
// pref and over the type-driven default. URL is authoritative. We trust KG to pick a function
// whose signature matches the builder's `{expr}` or `{expr, interval}` call shape; unknown
// names fall through to the queries pref or type default via the PROMQL_FUNCTIONS.get() check
// in the consuming loop.
function resolveQueryDefs(
  customFn: PrometheusFunction | undefined,
  queries: QueryDefs | undefined,
  defaultFn: PrometheusFunction
): QueryDefs {
  if (customFn) {
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
  const interval = queryConfig.customRateInterval ?? '$__rate_interval';
  const customFn = queryConfig.customFunction;

  // KG-supplied customFunction workaround (issue #1131). Some PromQL functions take a range
  // vector and require `[interval]`; the canonical list lives in Prometheus's parser table at
  // https://github.com/prometheus/prometheus/blob/main/promql/parser/functions.go (entries
  // whose ArgTypes include ValueTypeMatrix). We do not vendor that list; instead we match on
  // the `_over_time` suffix, the Prometheus naming convention for the range-vector aggregation
  // family. KG owns picking a function that fits the call shape; any function name is emitted
  // verbatim.
  if (customFn) {
    const isRange = customFn.endsWith('_over_time');
    const queryExpr = isRange ? `${customFn}(${expr}[${interval}])` : `${customFn}(${expr})`;
    const fnName = isRateQuery ? `${customFn}(rate)` : customFn;
    return [
      {
        refId: `${metric.name}-${fnName}`,
        expr: queryExpr,
        legendFormat: fnName,
        fromExploreMetrics: true,
      },
    ];
  }

  // No customFunction: queries pref from the configurator, or the type default. Registry path.
  const queryDefs: QueryDefs = queryConfig.queries?.length ? queryConfig.queries : [{ fn: defaultPromqlFn }];
  const queries: SceneDataQuery[] = [];

  for (const { fn } of queryDefs) {
    const entry = PROMQL_FUNCTIONS.get(fn);
    if (!entry) {
      logger.warn(`[getStatQueryRunnerParams] Unknown PromQL function "${fn}", skipping query.`);
      continue;
    }
    const isRangeFn = entry.name.endsWith('_over_time');
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
