import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression, expressionToString } from 'GmdVizPanel/buildQueryExpression';
import { QUERY_RESOLUTION } from 'GmdVizPanel/config/query-resolutions';
import { type QueryConfig } from 'GmdVizPanel/GmdVizPanel';

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
  });
  const query = promql.min({ expr: expressionToString(expression) });

  return {
    maxDataPoints: queryConfig.resolution === QUERY_RESOLUTION.HIGH ? 200 : 100,
    queries: [
      {
        refId: metric,
        expr: query,
        legendFormat: 'status',
        fromExploreMetrics: true,
      },
    ],
  };
}
