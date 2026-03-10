import { type PrometheusFunction } from 'shared/GmdVizPanel/config/promql-functions';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { logger } from 'shared/logger/logger';

import { getStatQueryRunnerParams } from '../getStatQueryRunnerParams';

describe('getStatQueryRunnerParams(options)', () => {
  test('handles gauge metrics', () => {
    const result = getStatQueryRunnerParams({
      metric: { name: 'go_goroutines', type: 'gauge' },
      queryConfig: {
        resolution: QUERY_RESOLUTION.HIGH,
        labelMatchers: [{ key: 'instance', operator: '=', value: 'us-east:5000' }],
        addIgnoreUsageFilter: true,
        queries: [],
      },
    });

    expect(result.isRateQuery).toBe(false);
    expect(result.maxDataPoints).toBe(500);
    expect(result.queries).toStrictEqual([
      {
        refId: 'go_goroutines-avg',
        expr: 'avg(go_goroutines{instance="us-east:5000", __ignore_usage__="", ${filters:raw}})',
        legendFormat: 'avg',
        fromExploreMetrics: true,
      },
    ]);
  });

  test('skips unknown PromQL function and logs a warning', () => {
    const result = getStatQueryRunnerParams({
      metric: { name: 'go_goroutines', type: 'gauge' },
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [],
        addIgnoreUsageFilter: false,
        queries: [{ fn: 'unknown_fn' as PrometheusFunction }],
      },
    });

    expect(result.queries).toStrictEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      '[getStatQueryRunnerParams] Unknown PromQL function "unknown_fn", skipping query.'
    );
  });

  test('handles counter metrics', () => {
    const result = getStatQueryRunnerParams({
      metric: { name: 'go_gc_heap_frees_bytes_total', type: 'counter' },
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [{ key: 'job', operator: '!=', value: 'prometheus' }],
        addIgnoreUsageFilter: true,
        queries: [],
      },
    });

    expect(result.isRateQuery).toBe(true);
    expect(result.maxDataPoints).toBe(250);
    expect(result.queries).toStrictEqual([
      {
        refId: 'go_gc_heap_frees_bytes_total-sum(rate)',
        expr: 'sum(rate(go_gc_heap_frees_bytes_total{job!="prometheus", __ignore_usage__="", ${filters:raw}}[$__rate_interval]))',
        legendFormat: 'sum(rate)',
        fromExploreMetrics: true,
      },
    ]);
  });
});
