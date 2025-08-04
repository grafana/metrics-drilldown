import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression, expressionToString, type LabelMatcher } from '../buildQueryExpression';

type HeatmapQueryParams = {
  fnName: string;
  maxDataPoints: number;
  queries: SceneDataQuery[];
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
    maxDataPoints: 250,
    queries: [
      {
        refId: metric,
        expr: query,
        format: 'heatmap',
        fromExploreMetrics: true,
      },
    ],
  };
}
