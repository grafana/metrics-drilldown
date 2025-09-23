import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { PROMQL_FUNCTIONS } from 'shared/GmdVizPanel/config/promql-functions';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { type QueryConfig, type QueryDefs } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';

import { type GetQueryRunnerParamsOptions, type QueryRunnerParams } from '../panelBuilder';

const DEFAULT_PERCENTILES = [99, 90, 50] as const;

export function getPercentilesQueryRunnerParams(options: GetQueryRunnerParamsOptions): QueryRunnerParams {
  const { metric, queryConfig } = options;
  const expression = buildQueryExpression({
    metric,
    labelMatchers: queryConfig.labelMatchers,
    addIgnoreUsageFilter: queryConfig.addIgnoreUsageFilter,
    addExtremeValuesFiltering: queryConfig.addExtremeValuesFiltering,
  });

  const isHistogramMetric = ['classic-histogram', 'native-histogram'].includes(metric.type);

  const queries = !isHistogramMetric
    ? buildNonHistogramQueries({ metric, queryConfig, expr: expression })
    : buildHistogramQueries({ metric, queryConfig, expr: expression });

  return {
    isRateQuery: isHistogramMetric ? true : metric.type === 'counter',
    maxDataPoints: queryConfig.resolution === QUERY_RESOLUTION.HIGH ? 500 : 250,
    queries,
  };
}

function buildHistogramQueries({
  metric,
  queryConfig,
  expr,
}: {
  metric: Metric;
  queryConfig: QueryConfig;
  expr: string;
}): SceneDataQuery[] {
  const queryDefs: QueryDefs = queryConfig.queries?.length
    ? queryConfig.queries
    : [{ fn: 'histogram_quantile', params: { percentiles: DEFAULT_PERCENTILES } }];

  const queries: SceneDataQuery[] = [];

  const newExpr =
    metric.type === 'native-histogram'
      ? promql.sum({ expr: promql.rate({ expr }) })
      : promql.sum({ expr: promql.rate({ expr }), by: ['le'] });

  for (const { fn, params } of queryDefs) {
    const entry = PROMQL_FUNCTIONS.get(fn)!;
    const fnName = entry.name;
    const percentiles = params?.percentiles || DEFAULT_PERCENTILES;

    for (const percentile of percentiles) {
      const parameter = percentile / 100;
      const query = entry.fn({ expr: newExpr, parameter });

      queries.push({
        refId: `${metric.name}-p${percentile}-${fnName}`,
        expr: query,
        legendFormat: `${percentile}th Percentile`,
        fromExploreMetrics: true,
      });
    }
  }

  return queries;
}

function buildNonHistogramQueries({
  metric,
  queryConfig,
  expr,
}: {
  metric: Metric;
  queryConfig: QueryConfig;
  expr: string;
}): SceneDataQuery[] {
  const isRateQuery = metric.type === 'counter';
  const queryDefs: QueryDefs = queryConfig.queries?.length
    ? queryConfig.queries
    : [{ fn: 'quantile', params: { percentiles: [99, 90, 50] } }];

  const queries: SceneDataQuery[] = [];
  const newExpr = isRateQuery ? promql.rate({ expr }) : expr;

  for (const { fn, params } of queryDefs) {
    const entry = PROMQL_FUNCTIONS.get(fn)!;
    const fnName = isRateQuery ? `${entry.name}(rate)` : entry.name;

    for (const percentile of params!.percentiles) {
      const parameter = percentile / 100;
      const query = entry.fn({ expr: newExpr, parameter });

      queries.push({
        refId: `${metric.name}-p${percentile}-${fnName}`,
        expr: query,
        legendFormat: `${percentile}th Percentile`,
        fromExploreMetrics: true,
      });
    }
  }

  return queries;
}
