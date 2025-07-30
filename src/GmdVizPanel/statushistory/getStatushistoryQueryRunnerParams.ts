import { promql, type Expression } from 'tsqtsq';

import { buildQueryExpression, expressionToString, type LabelMatcher } from '../buildQueryExpression';

type StatushistoryQueryParams = {
  fnName: string;
  expression: Expression;
  query: string;
  maxDataPoints: number;
};

export function getStatushistoryQueryRunnerParams(metric: string, matchers: LabelMatcher[]): StatushistoryQueryParams {
  const expression = buildQueryExpression(metric, matchers);
  const query = promql.min({ expr: expressionToString(expression) });

  return {
    fnName: 'min',
    expression,
    query,
    maxDataPoints: 100,
  };
}
