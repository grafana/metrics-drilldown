import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { QUERY_RESOLUTION } from 'GmdVizPanel/GmdVizPanel';

import { buildQueryExpression, expressionToString } from '../buildQueryExpression';
import { type StatushistoryPanelOptions } from './buildStatushistoryPanel';

type StatushistoryQueryRunnerParams = {
  fnName: string;
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

type Options = Pick<StatushistoryPanelOptions, 'metric' | 'matchers' | 'queryResolution'> & {
  addIgnoreUsageFilter: boolean;
};

export function getStatushistoryQueryRunnerParams(options: Options): StatushistoryQueryRunnerParams {
  const { metric, matchers, queryResolution, addIgnoreUsageFilter } = options;

  const expression = buildQueryExpression({ metric, matchers, addIgnoreUsageFilter });
  const query = promql.min({ expr: expressionToString(expression) });

  return {
    fnName: 'min',
    maxDataPoints: queryResolution === QUERY_RESOLUTION.HIGH ? 200 : 100,
    queries: [
      {
        refId: metric,
        expr: query,
        fromExploreMetrics: true,
      },
    ],
  };
}
