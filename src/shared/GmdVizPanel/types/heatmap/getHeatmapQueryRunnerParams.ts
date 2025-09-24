import { promql } from 'tsqtsq';

import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';

import { type GetQueryRunnerParamsOptions, type QueryRunnerParams } from '../panelBuilder';

export function getHeatmapQueryRunnerParams(options: GetQueryRunnerParamsOptions): QueryRunnerParams {
  const { metric, histogramType, queryConfig } = options;
  const expression = buildQueryExpression({
    metric,
    labelMatchers: queryConfig.labelMatchers,
    addIgnoreUsageFilter: queryConfig.addIgnoreUsageFilter,
    addExtremeValuesFiltering: queryConfig.addExtremeValuesFiltering,
  });

  const query =
    histogramType === 'native'
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
