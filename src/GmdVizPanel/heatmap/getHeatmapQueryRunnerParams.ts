import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { QUERY_RESOLUTION } from 'GmdVizPanel/GmdVizPanel';

import { buildQueryExpression, expressionToString } from '../buildQueryExpression';
import { type HeatmapPanelOptions } from './buildHeatmapPanel';

type HeatmapQueryRunnerParams = {
  fnName: string;
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

type Options = Pick<HeatmapPanelOptions, 'metric' | 'matchers' | 'isNativeHistogram' | 'queryResolution'> & {
  addIgnoreUsageFilter: boolean;
};

export function getHeatmapQueryRunnerParams(options: Options): HeatmapQueryRunnerParams {
  const { metric, matchers, isNativeHistogram, queryResolution, addIgnoreUsageFilter } = options;

  const expression = buildQueryExpression({ metric, matchers, addIgnoreUsageFilter });
  let expr = expressionToString(expression);

  let query;
  let fnName;

  if (isNativeHistogram) {
    expr = promql.rate({ expr, interval: '$__rate_interval' });
    query = promql.sum({ expr });
    fnName = 'sum(rate)';
  } else {
    expr = promql.rate({ expr, interval: '$__rate_interval' });
    query = promql.sum({ expr, by: ['le'] });
    fnName = 'sum by (le) (rate)';
  }

  return {
    fnName,
    maxDataPoints: queryResolution === QUERY_RESOLUTION.HIGH ? 500 : 250,
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
