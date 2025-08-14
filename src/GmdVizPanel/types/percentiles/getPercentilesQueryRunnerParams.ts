import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression, expressionToString } from 'GmdVizPanel/buildQueryExpression';
import { PROMQL_FUNCTIONS } from 'GmdVizPanel/config/promql-functions';
import { QUERY_RESOLUTION } from 'GmdVizPanel/config/query-resolutions';
import { type HistogramType, type QueryConfig, type QueryDefs } from 'GmdVizPanel/GmdVizPanel';

import { isCounterMetric } from '../..//matchers/isCounterMetric';

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
  const isRateQuery = isCounterMetric(metric);
  const expression = buildQueryExpression({
    metric,
    labelMatchers: queryConfig.labelMatchers,
    addIgnoreUsageFilter: queryConfig.addIgnoreUsageFilter,
  });
  const expr = expressionToString(expression);
  const queries =
    histogramType === 'none'
      ? buildNonHistogramQueries({
          metric,
          queryConfig,
          isRateQuery,
          expr,
        })
      : buildHistogramQueries({
          metric,
          isNativeHistogram: histogramType === 'native',
          queryConfig,
          expr,
        });

  return {
    isRateQuery,
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
    ? promql.rate({ expr })
    : promql.sum({
        expr: promql.rate({ expr }),
        by: ['le'],
      });

  for (const { fn, params } of queryDefs) {
    const entry = PROMQL_FUNCTIONS.get(fn)!;
    const fnName = `${entry.name}(rate)`;
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
