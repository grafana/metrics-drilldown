import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';

import { buildQueryExpression, expressionToString } from '../buildQueryExpression';
import { type StatushistoryPanelOptions } from './buildStatushistoryPanel';

type StatushistoryQueryOptions = Pick<StatushistoryPanelOptions, 'metric' | 'matchers' | 'queryResolution'>;

type StatushistoryQueryParams = {
  fnName: string;
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

export function getStatushistoryQueryRunnerParams(options: StatushistoryQueryOptions): StatushistoryQueryParams {
  const { metric, matchers, queryResolution } = options;
  const expression = buildQueryExpression(metric, matchers);
  const query = promql.min({ expr: expressionToString(expression) });

  return {
    fnName: 'min',
    maxDataPoints: queryResolution === GmdVizPanel.QUERY_RESOLUTION.HIGH ? 200 : 100,
    queries: [
      {
        refId: metric,
        expr: query,
        fromExploreMetrics: true,
      },
    ],
  };
}
