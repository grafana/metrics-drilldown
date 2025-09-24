import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { type QueryConfig } from 'shared/GmdVizPanel/GmdVizPanel';

type StatushistoryQueryRunnerParams = {
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

type Options = {
  metric: string;
  queryConfig: QueryConfig;
};

export function getStatushistoryQueryRunnerParams(options: Options): StatushistoryQueryRunnerParams {
  const { metric, queryConfig } = options;
  const expression = buildQueryExpression({
    metric,
    labelMatchers: queryConfig.labelMatchers,
    addIgnoreUsageFilter: queryConfig.addIgnoreUsageFilter,
    addExtremeValuesFiltering: queryConfig.addExtremeValuesFiltering,
  });

  const query = promql.min({ expr: expression });

  return {
    maxDataPoints: queryConfig.resolution === QUERY_RESOLUTION.HIGH ? 200 : 100,
    queries: [
      {
        refId: `${metric}-status`,
        expr: query,
        legendFormat: 'status',
        fromExploreMetrics: true,
      },
    ],
  };
}
