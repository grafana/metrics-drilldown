import { promql } from 'tsqtsq';

import { buildQueryExpression, expressionToString } from '../buildQueryExpression';
import { type LabelMatcher, type PanelQueryParams } from '../getPanelBuilderOptions';

export function buildStatusHistoryQuery(metric: string, matchers: LabelMatcher[]): PanelQueryParams {
  const expression = buildQueryExpression(metric, matchers);
  const query = promql.min({ expr: expressionToString(expression) });

  return {
    fnName: 'min',
    isRateQuery: false,
    expression,
    query,
    maxDataPoints: 100,
  };
}
