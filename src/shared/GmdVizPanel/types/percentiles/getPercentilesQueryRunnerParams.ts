import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { PROMQL_FUNCTIONS } from 'shared/GmdVizPanel/config/promql-functions';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { type HistogramType, type QueryConfig, type QueryDefs } from 'shared/GmdVizPanel/GmdVizPanel';

import { isCounterMetric as isCounterMetricFn } from '../..//matchers/isCounterMetric';

type PercentilesQueryRunnerParams = {
  isRateQuery: boolean;
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

type Options = {
  metric: string;
  histogramType: HistogramType;
  queryConfig: QueryConfig;
};

const DEFAULT_PERCENTILES = [99, 90, 50] as const;

export function getPercentilesQueryRunnerParams(options: Options): PercentilesQueryRunnerParams {
  const { metric, histogramType, queryConfig } = options;
  const isCounterMetric = isCounterMetricFn(metric);
  const expression = buildQueryExpression({
    metric,
    labelMatchers: queryConfig.labelMatchers,
    addIgnoreUsageFilter: queryConfig.addIgnoreUsageFilter,
    addExtremeValuesFiltering: queryConfig.addExtremeValuesFiltering,
  });

  const queries =
    histogramType === 'none'
      ? buildNonHistogramQueries({
          metric,
          queryConfig,
          isRateQuery: isCounterMetric,
          expr: expression,
        })
      : buildHistogramQueries({
          metric,
          isNativeHistogram: histogramType === 'native',
          queryConfig,
          expr: expression,
        });

  return {
    isRateQuery: histogramType !== 'none' ? true : isCounterMetric,
    maxDataPoints: queryConfig.resolution === QUERY_RESOLUTION.HIGH ? 500 : 250,
    queries,
  };
}

function buildHistogramQueries({
  metric,
  isNativeHistogram,
  queryConfig,
  expr,
}: {
  metric: string;
  isNativeHistogram: boolean;
  queryConfig: QueryConfig;
  expr: string;
}): SceneDataQuery[] {
  const queryDefs: QueryDefs = queryConfig.queries?.length
    ? queryConfig.queries
    : [{ fn: 'histogram_quantile', params: { percentiles: DEFAULT_PERCENTILES } }];

  const queries: SceneDataQuery[] = [];

  const newExpr = isNativeHistogram
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
        refId: `${metric}-p${percentile}-${fnName}`,
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
  isRateQuery,
  expr,
}: {
  metric: string;
  queryConfig: QueryConfig;
  isRateQuery: boolean;
  expr: string;
}): SceneDataQuery[] {
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
        refId: `${metric}-p${percentile}-${fnName}`,
        expr: query,
        legendFormat: `${percentile}th Percentile`,
        fromExploreMetrics: true,
      });
    }
  }

  return queries;
}
