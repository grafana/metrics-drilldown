import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';

import { buildQueryExpression, expressionToString } from '../buildQueryExpression';
import { type HeatmapPanelOptions } from './buildHeatmapPanel';

type HeatmapQueryOptions = Pick<HeatmapPanelOptions, 'metric' | 'matchers' | 'isNativeHistogram' | 'queryResolution'>;

type HeatmapQueryParams = {
  fnName: string;
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

export function getHeatmapQueryRunnerParams(options: HeatmapQueryOptions): HeatmapQueryParams {
  const { metric, matchers, isNativeHistogram, queryResolution } = options;
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
    maxDataPoints: queryResolution === GmdVizPanel.QUERY_RESOLUTION.HIGH ? 500 : 250,
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
