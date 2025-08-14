import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression, expressionToString } from 'GmdVizPanel/buildQueryExpression';
import { PROMQL_FUNCTIONS } from 'GmdVizPanel/config/promql-functions';
import { QUERY_RESOLUTION } from 'GmdVizPanel/config/query-resolutions';
import { type QueryConfig, type QueryDefs } from 'GmdVizPanel/GmdVizPanel';

import { isCounterMetric } from '../../matchers/isCounterMetric';

type TimeseriesQueryRunnerParams = {
  isRateQuery: boolean;
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

type Options = {
  metric: string;
  queryConfig: QueryConfig;
};

export function getStatQueryRunnerParams(options: Options): TimeseriesQueryRunnerParams {
  const { metric, queryConfig } = options;
  const isRateQuery = isCounterMetric(metric);
  const expression = buildQueryExpression({
    metric,
    labelMatchers: queryConfig.labelMatchers,
    addIgnoreUsageFilter: queryConfig.addIgnoreUsageFilter,
  });

  let expr = expressionToString(expression);

  if (isRateQuery) {
    expr = promql.rate({ expr, interval: '$__rate_interval' });
  }

  return {
    isRateQuery,
    maxDataPoints: queryConfig.resolution === QUERY_RESOLUTION.HIGH ? 500 : 250,
    queries: buildQueriesWithPresetFunctions({ metric, queryConfig, isRateQuery, expr }),
  };
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
