import { utf8Support } from '@grafana/prometheus';
import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildCustomFunctionQuery, buildPresetFunctionQuery } from 'shared/GmdVizPanel/buildFunctionQuery';
import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { isRangeVectorFunction, PROMQL_FUNCTIONS, type PrometheusFunction } from 'shared/GmdVizPanel/config/promql-functions';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { type QueryConfig, type QueryDefs } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';
import { logger } from 'shared/logger/logger';

import { type GetQueryRunnerParamsOptions, type QueryRunnerParams } from '../panelBuilder';

export function getTimeseriesQueryRunnerParams(options: GetQueryRunnerParamsOptions): QueryRunnerParams {
  const { metric, queryConfig } = options;

  // A binary (ratio) insight query is a complete expression, not a metric selector: use it verbatim as
  // the query body and never wrap it in rate() (rate requires a range-vector selector, not an expression).
  // The grouping wrapper from the convention (<aggFn> by (label) (...)) is still applied downstream.
  //
  // ASSUMES BARE OPERANDS, e.g. `(kg_metric{...} + 2) / (kg_metric{...} + 20)`, where each
  // operand still carries its labels, so the outer `... by (L) (...)` can group on L. This does NOT yet
  // handle pre-aggregated operands like `sum(rate(a)) / sum(rate(b))`: the inner sum() collapses L before
  // the outer by(L) sees it, so the breakdown would group nothing. That case needs by(L) injected into the
  // inner aggregation instead (parseBinaryQuery flags it via `preAggregated`); deferred until KG confirms it
  // sends pre-aggregated operands. Label discovery is unaffected (it uses each operand's inner selector).
  const isBinaryExpr = Boolean(queryConfig.binaryExpr);
  const expression = isBinaryExpr
    ? (queryConfig.binaryExpr as string)
    : buildQueryExpression({
        metric,
        labelMatchers: queryConfig.labelMatchers,
        addIgnoreUsageFilter: queryConfig.addIgnoreUsageFilter,
        addExtremeValuesFiltering: queryConfig.addExtremeValuesFiltering,
      });

  const isRateQuery = !isBinaryExpr && metric.type === 'counter';
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
    // PromQL grammar does not let `by` attach to `fn(metric[interval])`, so range functions
    // (see isRangeVectorFunction) are wrapped in the type-default instant aggregation.
    const isRange = isRangeVectorFunction(customFn);
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
    const q = buildPresetFunctionQuery(metric.name, fn, expr, isCounter, '[getTimeseriesQueryRunnerParams]');
    if (q) {
      queries.push(q);
    }
  }
  return queries;
}
