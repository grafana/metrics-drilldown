import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';

import { buildQueryExpression, expressionToString } from '../buildQueryExpression';
import { type TimeseriesPanelOptions } from './buildTimeseriesPanel';
import { isRateQuery as isRateQueryFn } from './isRateQuery';

type TimeseriesQueryOptions = Pick<TimeseriesPanelOptions, 'metric' | 'matchers' | 'groupBy' | 'queryResolution'>;

type TimeseriesQueryParams = {
  fnName: string;
  isRateQuery: boolean;
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

export function getTimeseriesQueryRunnerParams(options: TimeseriesQueryOptions): TimeseriesQueryParams {
  const { metric, matchers, groupBy, queryResolution } = options;
  const expression = buildQueryExpression(metric, matchers);
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
    maxDataPoints: queryResolution === GmdVizPanel.QUERY_RESOLUTION.HIGH ? 500 : 250,
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
