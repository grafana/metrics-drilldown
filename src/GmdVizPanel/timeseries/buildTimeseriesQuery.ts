import { promql } from 'tsqtsq';

import { buildQueryExpression, expressionToString } from '../buildQueryExpression';
import { type LabelMatcher, type PanelQueryParams } from '../getPanelBuilderOptions';
import { isRateQuery as isRateQueryFn } from './isRateQuery';

export function buildTimeseriesQuery(metric: string, matchers: LabelMatcher[]): PanelQueryParams {
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
    query,
    expression,
    maxDataPoints: 250,
  };
}
