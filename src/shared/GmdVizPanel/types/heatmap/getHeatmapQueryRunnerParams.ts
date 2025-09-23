import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { type QueryConfig } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';

type HeatmapQueryRunnerParams = {
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

type Options = {
  metric: Metric;
  queryConfig: QueryConfig;
};

export function getHeatmapQueryRunnerParams(options: Options): HeatmapQueryRunnerParams {
  const { metric, queryConfig } = options;
  const expression = buildQueryExpression({
    metric,
    labelMatchers: queryConfig.labelMatchers,
    addIgnoreUsageFilter: queryConfig.addIgnoreUsageFilter,
    addExtremeValuesFiltering: queryConfig.addExtremeValuesFiltering,
  });

  const query =
    metric.type === 'native-histogram'
      ? promql.sum({ expr: promql.rate({ expr: expression }) })
      : promql.sum({ expr: promql.rate({ expr: expression }), by: ['le'] });

  return {
    maxDataPoints: queryConfig.resolution === QUERY_RESOLUTION.HIGH ? 500 : 250,
    queries: [
      {
        refId: `${metric.name}-heatmap`,
        expr: query,
        format: 'heatmap',
        fromExploreMetrics: true,
      },
    ],
  };
}
