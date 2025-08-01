import { promql, type Expression } from 'tsqtsq';

import { buildQueryExpression, expressionToString, type LabelMatcher } from '../buildQueryExpression';

type HeatmapQueryParams = {
  fnName: string;
  expression: Expression;
  query: string;
  maxDataPoints: number;
  format: string;
};

export function getHeatmapQueryRunnerParams(
  metric: string,
  matchers: LabelMatcher[],
  isNativeHistogram: boolean
): HeatmapQueryParams {
  const expression = buildQueryExpression(metric, matchers);
  let expr = expressionToString(expression);

  let query;
  let fnName;

  if (isNativeHistogram) {
    query = promql.rate({ expr, interval: '$__rate_interval' });
    fnName = 'rate';
  } else {
    expr = promql.rate({ expr, interval: '$__rate_interval' });
    query = promql.sum({ expr, by: ['le'] });
    fnName = 'sum by (le) (rate)';
  }

  return {
    fnName,
    expression,
    query,
    maxDataPoints: 250,
    format: 'heatmap',
  };
}
