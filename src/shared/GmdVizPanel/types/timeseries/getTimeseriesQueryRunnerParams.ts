import { utf8Support } from '@grafana/prometheus';
import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildCustomFunctionQuery, buildPresetFunctionQuery } from 'shared/GmdVizPanel/buildFunctionQuery';
import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { isRangeVectorFunction, PROMQL_FUNCTIONS, type PrometheusFunction } from 'shared/GmdVizPanel/config/promql-functions';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { type HistogramBreakdownFn, type QueryConfig, type QueryDefs } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';
import { logger } from 'shared/logger/logger';
import { groupBinaryByLabel } from 'shared/utils/groupBinaryByLabel';

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

  let queries: SceneDataQuery[];
  if (queryConfig.groupBy) {
    queries = buildGroupByQueries({ metric, queryConfig, expr });
  } else if (isBinaryExpr) {
    // A binary query is already a complete expression: render it verbatim (no aggregation wrap), matching
    // what the user sees in Explore. The legend defaults to "binary query" (main panel), but callers that
    // scope the binary to a single value (the per-value breakdown) pass that value via `binaryLegend`.
    queries = [
      { refId: metric.name, expr, legendFormat: queryConfig.binaryLegend ?? 'binary query', fromExploreMetrics: true },
    ];
  } else {
    queries = buildQueriesWithPresetFunctions({ metric, queryConfig, expr });
  }

  return {
    isRateQuery,
    maxDataPoints: queryConfig.resolution === QUERY_RESOLUTION.HIGH ? 500 : 250,
    queries,
  };
}

const HISTOGRAM_BY_LABEL_PERCENTILES: Record<Exclude<HistogramBreakdownFn, 'sum'>, number> = {
  p99: 99,
  p95: 95,
  p75: 75,
  p50: 50,
};

// Classic histograms expose the total as the _sum sibling series (_bucket/_sum/_count convention).
function toSumMetricSelector(bucketSelector: string): string {
  const openBrace = bucketSelector.indexOf('{');
  const metricName = openBrace === -1 ? bucketSelector : bucketSelector.slice(0, openBrace);
  const rest = openBrace === -1 ? '' : bucketSelector.slice(openBrace);
  return `${metricName.replace(/_bucket$/, '_sum')}${rest}`;
}

function buildHistogramSumByLabelQuery(metric: Metric, queryConfig: QueryConfig, expr: string, groupByLabel: string): SceneDataQuery[] {
  const interval = queryConfig.customRateInterval ?? '$__rate_interval';
  const isClassic = metric.type === 'classic-histogram';
  const sumExpr = isClassic ? toSumMetricSelector(expr) : expr;
  const innerVector = promql.sum({ expr: promql.rate({ expr: sumExpr, interval }), by: [groupByLabel] });
  // histogram_sum() only accepts native-histogram-typed samples; the _sum sibling is already a plain float.
  const queryExpr = isClassic ? innerVector : `histogram_sum(${innerVector})`;

  return [
    {
      refId: `${metric.name}-by-${queryConfig.groupBy}`,
      expr: queryExpr,
      legendFormat: `{{${groupByLabel}}}`,
      fromExploreMetrics: true,
    },
  ];
}

function buildHistogramPercentileByLabelQuery(
  metric: Metric,
  queryConfig: QueryConfig,
  expr: string,
  groupByLabel: string,
  fn: Exclude<HistogramBreakdownFn, 'sum'>
): SceneDataQuery[] {
  const interval = queryConfig.customRateInterval ?? '$__rate_interval';
  const by = metric.type === 'classic-histogram' ? [groupByLabel, 'le'] : [groupByLabel];
  const innerVector = promql.sum({ expr: promql.rate({ expr, interval }), by });

  const entry = PROMQL_FUNCTIONS.get('histogram_quantile');
  if (!entry) {
    logger.warn('[getTimeseriesQueryRunnerParams] Unknown PromQL function "histogram_quantile", skipping query.');
    return [];
  }

  const queryExpr = entry.fn({ expr: innerVector, parameter: HISTOGRAM_BY_LABEL_PERCENTILES[fn] / 100 });

  return [
    {
      refId: `${metric.name}-by-${queryConfig.groupBy}`,
      expr: queryExpr,
      legendFormat: `{{${groupByLabel}}}`,
      fromExploreMetrics: true,
    },
  ];
}

function buildHistogramByLabelQuery(metric: Metric, queryConfig: QueryConfig, expr: string, groupByLabel: string): SceneDataQuery[] {
  const fn = queryConfig.histogramBreakdownFn ?? 'sum';
  if (fn === 'sum') {
    return buildHistogramSumByLabelQuery(metric, queryConfig, expr, groupByLabel);
  }
  return buildHistogramPercentileByLabelQuery(metric, queryConfig, expr, groupByLabel, fn);
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
  const groupByLabel = utf8Support(queryConfig.groupBy as string);

  // A binary (ratio) query groups by injecting `by (label)` into each operand's aggregation, NOT by
  // wrapping the whole binary: a pre-aggregated operand (`sum(rate(...))`) has already dropped its
  // labels, so `sum by (label) (<binary>)` would collapse everything into `<unspecified>`.
  if (queryConfig.binaryExpr) {
    const groupedBinary = groupBinaryByLabel(queryConfig.binaryExpr, groupByLabel);
    if (!groupedBinary) {
      return [];
    }
    return [
      {
        refId: `${metric.name}-by-${queryConfig.groupBy}`,
        expr: groupedBinary,
        legendFormat: `{{${groupByLabel}}}`,
        fromExploreMetrics: true,
      },
    ];
  }

  if (metric.type === 'classic-histogram' || metric.type === 'native-histogram') {
    return buildHistogramByLabelQuery(metric, queryConfig, expr, groupByLabel);
  }

  return buildDefaultByLabelQuery(metric, queryConfig, expr, groupByLabel);
}

function buildDefaultByLabelQuery(metric: Metric, queryConfig: QueryConfig, expr: string, groupByLabel: string): SceneDataQuery[] {
  let typeDefault: PrometheusFunction = 'avg';
  if (metric.type === 'counter') {
    typeDefault = 'sum';
  } else if (metric.type === 'info') {
    typeDefault = 'count';
  }

  const customFn = queryConfig.customFunction;
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
