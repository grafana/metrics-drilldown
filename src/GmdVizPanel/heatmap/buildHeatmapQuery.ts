import { promql } from 'tsqtsq';

import { buildQueryExpression, expressionToString } from '../buildQueryExpression';
import { type LabelMatcher, type PanelQueryParams } from '../getPanelBuilderOptions';

export function buildHeatmapQuery(
  metric: string,
  isNativeHistogram: boolean,
  matchers: LabelMatcher[]
): PanelQueryParams {
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
    isRateQuery: false,
    query,
    expression,
    maxDataPoints: 250,
    format: 'heatmap',
  };
}
