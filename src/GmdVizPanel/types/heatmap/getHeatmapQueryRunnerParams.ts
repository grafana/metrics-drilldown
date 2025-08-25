import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression, expressionToString } from 'GmdVizPanel/buildQueryExpression';
import { QUERY_RESOLUTION } from 'GmdVizPanel/config/query-resolutions';
import { type QueryConfig } from 'GmdVizPanel/GmdVizPanel';

type HeatmapQueryRunnerParams = {
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

type Options = {
  metric: string;
  isNativeHistogram: boolean;
  queryConfig: QueryConfig;
};

export function getHeatmapQueryRunnerParams(options: Options): HeatmapQueryRunnerParams {
  const { metric, isNativeHistogram, queryConfig } = options;
  const expression = buildQueryExpression({
    metric,
    labelMatchers: queryConfig.labelMatchers,
    addIgnoreUsageFilter: queryConfig.addIgnoreUsageFilter,
  });

  const expr = promql.rate({
    expr: expressionToString(expression),
    interval: '$__rate_interval',
  });

  const query = promql.sum({
    expr,
    by: isNativeHistogram ? [] : ['le'],
  });

  return {
    maxDataPoints: queryConfig.resolution === QUERY_RESOLUTION.HIGH ? 500 : 250,
    queries: [
      {
        refId: `${metric}-heatmap`,
        expr: query,
        format: 'heatmap',
        fromExploreMetrics: true,
      },
    ],
  };
}
