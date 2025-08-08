import { type SceneDataQuery } from '@grafana/scenes';
import { promql } from 'tsqtsq';

import { buildQueryExpression, expressionToString } from 'GmdVizPanel/buildQueryExpression';
import { QUERY_RESOLUTION } from 'GmdVizPanel/GmdVizPanel';

import { type PercentilesPanelOptions } from './buildPercentilesPanel';

type PercentilesQueryRunnerParams = {
  fnName: string;
  isRateQuery: boolean;
  maxDataPoints: number;
  queries: SceneDataQuery[];
};

type Options = Pick<PercentilesPanelOptions, 'metric' | 'matchers' | 'isNativeHistogram' | 'queryResolution'> & {
  addIgnoreUsageFilter: boolean;
};

export function getPercentilesQueryRunnerParams(options: Options): PercentilesQueryRunnerParams {
  const { metric, matchers, isNativeHistogram, queryResolution, addIgnoreUsageFilter } = options;

  const expression = buildQueryExpression({ metric, matchers, addIgnoreUsageFilter });
  let expr = expressionToString(expression);
  let fnName;

  if (isNativeHistogram) {
    expr = promql.rate({ expr, interval: '$__rate_interval' });
    fnName = 'histogram_quantile(rate)';
  } else {
    expr = promql.rate({ expr, interval: '$__rate_interval' });
    expr = promql.sum({ expr, by: ['le'] });
    fnName = 'histogram_quantile(sum by (le) (rate))';
  }

  const queries = [99, 90, 50].map((percentile) => {
    const percent = percentile / 100;
    // tsqtsq does not provide the "histogram_quantile" function
    const query = `histogram_quantile(${percent}, ${expr})`;

    return {
      refId: `${metric}-p${percentile}`,
      expr: query,
      legendFormat: `${percentile}th Percentile`,
      fromExploreMetrics: true,
    };
  });

  return {
    fnName,
    isRateQuery: true,
    maxDataPoints: queryResolution === QUERY_RESOLUTION.HIGH ? 500 : 250,
    queries,
  };
}
