import { QUERY_RESOLUTION } from 'GmdVizPanel/config/query-resolutions';

import { getStatQueryRunnerParams } from '../getStatQueryRunnerParams';

describe('getStatQueryRunnerParams(options)', () => {
  test('handles gauge metrics', () => {
    const result = getStatQueryRunnerParams({
      metric: 'go_goroutines',
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
        expr: 'avg(go_goroutines{instance="us-east:5000", __ignore_usage__="", ${filters}})',
        legendFormat: 'avg',
        fromExploreMetrics: true,
      },
    ]);
  });

  test('handles counter metrics', () => {
    const result = getStatQueryRunnerParams({
      metric: 'go_gc_heap_frees_bytes_total',
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
        expr: 'sum(rate(go_gc_heap_frees_bytes_total{job!="prometheus", __ignore_usage__="", ${filters}}[$__rate_interval]))',
        legendFormat: 'sum(rate)',
        fromExploreMetrics: true,
      },
    ]);
  });
});
