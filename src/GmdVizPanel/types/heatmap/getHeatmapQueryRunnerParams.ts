import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression } from 'GmdVizPanel/buildQueryExpression';
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
    addExtremeValuesFiltering: queryConfig.addExtremeValuesFiltering,
  });

  const query = isNativeHistogram
    ? promql.sum({ expr: promql.rate({ expr: expression }) })
    : promql.sum({ expr: promql.rate({ expr: expression }), by: ['le'] });

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
