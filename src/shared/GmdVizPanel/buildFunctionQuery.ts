import { type SceneDataQuery } from '@grafana/scenes';

import { isRangeVectorFunction, PROMQL_FUNCTIONS, type PrometheusFunction } from 'shared/GmdVizPanel/config/promql-functions';
import { logger } from 'shared/logger/logger';

// TODO: once more query-construction primitives accumulate at the GmdVizPanel root, group
// buildQueryExpression and buildFunctionQuery under a dedicated `GmdVizPanel/query/` folder.

// Wraps a base expression (from buildQueryExpression) in a PromQL function and returns the
// resulting SceneDataQuery. Shared by the stat and timeseries query-runner builders.
// Scoped to the single-function-per-query shape only. Other builders (timeseries group-by,
// percentiles, heatmap, statushistory) emit different refId/legend/by shapes and stay separate.

// Range-vector functions need `[interval]`; see isRangeVectorFunction for the rationale.
// Any function name is emitted verbatim.
export function buildCustomFunctionQuery(
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

export function buildPresetFunctionQuery(
  metricName: string,
  fn: PrometheusFunction,
  expr: string,
  isRateQuery: boolean,
  loggerLabel: string
): SceneDataQuery | undefined {
  const entry = PROMQL_FUNCTIONS.get(fn);
  if (!entry) {
    logger.warn(`${loggerLabel} Unknown PromQL function "${fn}", skipping query.`);
    return undefined;
  }
  const fnName = isRateQuery ? `${entry.name}(rate)` : entry.name;
  return {
    refId: `${metricName}-${fnName}`,
    expr: entry.fn({ expr }),
    legendFormat: fnName,
    fromExploreMetrics: true,
  };
}
