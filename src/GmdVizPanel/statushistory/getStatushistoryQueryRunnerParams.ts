import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression, expressionToString, type LabelMatcher } from '../buildQueryExpression';

type StatushistoryQueryParams = {
  fnName: string;
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

export function getStatushistoryQueryRunnerParams(metric: string, matchers: LabelMatcher[]): StatushistoryQueryParams {
  const expression = buildQueryExpression(metric, matchers);
  const query = promql.min({ expr: expressionToString(expression) });

  return {
    fnName: 'min',
    maxDataPoints: 100,
    queries: [
      {
        refId: metric,
        expr: query,
        fromExploreMetrics: true,
      },
    ],
  };
}
