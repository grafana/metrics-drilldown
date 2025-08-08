import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { QUERY_RESOLUTION } from 'GmdVizPanel/GmdVizPanel';

import { buildQueryExpression, expressionToString } from '../buildQueryExpression';
import { type TimeseriesPanelOptions } from './buildTimeseriesPanel';
import { isRateQuery as isRateQueryFn } from './isRateQuery';

type TimeseriesQueryRunnerParams = {
  fnName: string;
  isRateQuery: boolean;
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

type Options = Pick<TimeseriesPanelOptions, 'metric' | 'matchers' | 'groupBy' | 'queryResolution'> & {
  addIgnoreUsageFilter: boolean;
};

export function getTimeseriesQueryRunnerParams(options: Options): TimeseriesQueryRunnerParams {
  const { metric, matchers, groupBy, queryResolution, addIgnoreUsageFilter } = options;

  const expression = buildQueryExpression({ metric, matchers, addIgnoreUsageFilter });
  let expr = expressionToString(expression);

  let query;
  let fnName;
  const isRateQuery = isRateQueryFn(metric);

  if (isRateQuery) {
    expr = promql.rate({ expr, interval: '$__rate_interval' });
    query = promql.sum({ expr, by: groupBy ? [groupBy] : undefined });
    fnName = 'sum(rate)';
  } else {
    query = promql.avg({ expr, by: groupBy ? [groupBy] : undefined });
    fnName = 'avg';
  }

  return {
    fnName,
    isRateQuery,
    maxDataPoints: queryResolution === QUERY_RESOLUTION.HIGH ? 500 : 250,
    queries: [
      {
        refId: groupBy ? `${metric}-by-${groupBy}` : metric,
        expr: query,
        legendFormat: groupBy ? `{{${groupBy}}}` : undefined,
        fromExploreMetrics: true,
      },
    ],
  };
}
