import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { PROMQL_FUNCTIONS } from 'shared/GmdVizPanel/config/promql-functions';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { type QueryConfig, type QueryDefs } from 'shared/GmdVizPanel/GmdVizPanel';

import { isCounterMetric } from '../../matchers/isCounterMetric';

type TimeseriesQueryRunnerParams = {
  isRateQuery: boolean;
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

type Options = {
  metric: string;
  queryConfig: QueryConfig;
  // When provided, overrides the name-based heuristic for applying rate().
  // This lets callers flip rate vs raw after an async metadata check.
  isRateQueryOverride?: boolean;
};

export function getTimeseriesQueryRunnerParams(options: Options): TimeseriesQueryRunnerParams {
  const { metric, queryConfig, isRateQueryOverride } = options;
  // Prefer explicit override when available; otherwise fall back to heuristic.
  const isRateQuery = typeof isRateQueryOverride === 'boolean' ? isRateQueryOverride : isCounterMetric(metric);

  const expression = buildQueryExpression({
    metric,
    labelMatchers: queryConfig.labelMatchers,
    addIgnoreUsageFilter: queryConfig.addIgnoreUsageFilter,
    addExtremeValuesFiltering: queryConfig.addExtremeValuesFiltering,
  });

  const expr = isRateQuery ? promql.rate({ expr: expression, interval: '$__rate_interval' }) : expression;

  return {
    isRateQuery,
    maxDataPoints: queryConfig.resolution === QUERY_RESOLUTION.HIGH ? 500 : 250,
    queries: queryConfig.groupBy
      ? buildGroupByQueries({ metric, queryConfig, isRateQuery, expr })
      : buildQueriesWithPresetFunctions({ metric, queryConfig, isRateQuery, expr }),
  };
}

// if grouped by, we don't provide support for preset functions
function buildGroupByQueries({
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
  return [
    {
      refId: `${metric}-by-${queryConfig.groupBy}`,
      expr: isRateQuery
        ? promql.sum({ expr, by: [queryConfig.groupBy!] })
        : promql.avg({ expr, by: [queryConfig.groupBy!] }),
      legendFormat: `{{${queryConfig.groupBy}}}`,
      fromExploreMetrics: true,
    },
  ];
}

// here we support preset functions
function buildQueriesWithPresetFunctions({
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
  const defaultPromqlFn = isRateQuery ? 'sum' : 'avg';
  const queryDefs: QueryDefs = queryConfig.queries?.length ? queryConfig.queries : [{ fn: defaultPromqlFn }];
  const queries: SceneDataQuery[] = [];

  for (const { fn } of queryDefs) {
    const entry = PROMQL_FUNCTIONS.get(fn)!;
    const query = entry.fn({ expr });
    const fnName = isRateQuery ? `${entry.name}(rate)` : entry.name;

    queries.push({
      refId: `${metric}-${fnName}`,
      expr: query,
      legendFormat: fnName,
      fromExploreMetrics: true,
    });
  }

  return queries;
}
