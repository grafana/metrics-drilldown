import { promql } from 'tsqtsq';

import { buildQueryExpression } from './buildQueryExpression';
import { type QueryConfig } from './GmdVizPanel';

/**
 * Builds the rated + aggregated probe expression (`sum(rate(metric[interval]))`) used to detect a native
 * histogram that exposes no metadata and returns empty for the default gauge query. Kept in one place so
 * the metric selector and rate/interval convention stay in sync with the real timeseries query builder
 * (see getTimeseriesQueryRunnerParams).
 */
export function buildNativeHistogramProbeExpr(
  metric: string,
  queryConfig: Pick<QueryConfig, 'labelMatchers' | 'addIgnoreUsageFilter' | 'customRateInterval'>
): string {
  const expression = buildQueryExpression({
    metric: { name: metric, type: 'gauge' },
    labelMatchers: queryConfig.labelMatchers,
    addIgnoreUsageFilter: queryConfig.addIgnoreUsageFilter,
  });
  const interval = queryConfig.customRateInterval ?? '$__rate_interval';

  return promql.sum({ expr: promql.rate({ expr: expression, interval }) });
}
