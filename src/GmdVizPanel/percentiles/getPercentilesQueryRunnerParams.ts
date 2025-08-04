import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression, expressionToString, type LabelMatcher } from 'GmdVizPanel/buildQueryExpression';

type PercentilesQueryParams = {
  fnName: string;
  isRateQuery: boolean;
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

export function getPercentilesQueryRunnerParams(
  metric: string,
  matchers: LabelMatcher[],
  isNativeHistogram: boolean
): PercentilesQueryParams {
  const expression = buildQueryExpression(metric, matchers);
  let expr = expressionToString(expression);

  if (isNativeHistogram) {
    expr = promql.rate({ expr, interval: '$__rate_interval' });
  } else {
    expr = promql.rate({ expr, interval: '$__rate_interval' });
    expr = promql.sum({ expr, by: ['le'] });
  }

  const queries = [99, 90, 50].map((percentile) => {
    const percent = percentile / 100;
    // tsqtsq does not provide the "histogram_quantile" function
    const query = `histogram_quantile(${percent}, ${expr})`;

    return {
      refId: `${metric}-p${percentile}`,
      expr: query,
      legendFormat: `${percentile}th Percentile`,
      fromExploreMetrics: true,
    };
  });

  return {
    fnName: isNativeHistogram ? 'histogram_quantile(rate)' : 'histogram_quantile(sum by (le) (rate))',
    isRateQuery: true,
    maxDataPoints: 250,
    queries,
  };
}
