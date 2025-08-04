import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression, expressionToString, type LabelMatcher } from '../buildQueryExpression';
import { isRateQuery as isRateQueryFn } from './isRateQuery';

type TimeseriesQueryParams = {
  fnName: string;
  isRateQuery: boolean;
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

export function getTimeseriesQueryRunnerParams(
  metric: string,
  matchers: LabelMatcher[],
  groupBy?: string
): TimeseriesQueryParams {
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
    maxDataPoints: 250,
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
