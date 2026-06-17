import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildCustomFunctionQuery, buildPresetFunctionQuery } from 'shared/GmdVizPanel/buildFunctionQuery';
import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { type QueryConfig, type QueryDefs } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';

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

  if (customFn) {
    return [buildCustomFunctionQuery(metric.name, customFn, expr, interval, isRateQuery)];
  }

  const queryDefs: QueryDefs = queryConfig.queries?.length ? queryConfig.queries : [{ fn: defaultPromqlFn }];
  const queries: SceneDataQuery[] = [];
  for (const { fn } of queryDefs) {
    const q = buildPresetFunctionQuery(metric.name, fn, expr, interval, isRateQuery, '[getStatQueryRunnerParams]');
    if (q) {
      queries.push(q);
    }
  }

  return queries;
}
