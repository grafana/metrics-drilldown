import { promql, type Expression } from 'tsqtsq';

import { buildQueryExpression, expressionToString, type LabelMatcher } from '../buildQueryExpression';
import { isRateQuery as isRateQueryFn } from './isRateQuery';

type TimeseriesQueryParams = {
  fnName: string;
  isRateQuery: boolean;
  expression: Expression;
  query: string;
  maxDataPoints: number;
};

export function getTimeseriesQueryRunnerParams(metric: string, matchers: LabelMatcher[]): TimeseriesQueryParams {
  const expression = buildQueryExpression(metric, matchers);
  let expr = expressionToString(expression);

  let query;
  let fnName;
  const isRateQuery = isRateQueryFn(metric);

  if (isRateQuery) {
    expr = promql.rate({ expr, interval: '$__rate_interval' });
    query = promql.sum({ expr });
    fnName = 'sum(rate)';
  } else {
    query = promql.avg({ expr });
    fnName = 'avg';
  }

  return {
    fnName,
    isRateQuery,
    expression,
    query,
    maxDataPoints: 250,
  };
}
