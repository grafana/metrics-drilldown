import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { PROMQL_FUNCTIONS } from 'shared/GmdVizPanel/config/promql-functions';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { type QueryConfig, type QueryDefs } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';

import { type GetQueryRunnerParamsOptions, type QueryRunnerParams } from '../panelBuilder';

export function getTimeseriesQueryRunnerParams(options: GetQueryRunnerParamsOptions): QueryRunnerParams {
  const { metric, queryConfig } = options;
  const isRateQuery = metric.type === 'counter';
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
  metric: Metric;
  queryConfig: QueryConfig;
  isRateQuery: boolean;
  expr: string;
}): SceneDataQuery[] {
  return [
    {
      refId: `${metric.name}-by-${queryConfig.groupBy}`,
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
  metric: Metric;
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
      refId: `${metric.name}-${fnName}`,
      expr: query,
      legendFormat: fnName,
      fromExploreMetrics: true,
    });
  }

  return queries;
}
