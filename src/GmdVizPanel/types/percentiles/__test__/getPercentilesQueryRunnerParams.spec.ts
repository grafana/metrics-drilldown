import { QUERY_RESOLUTION } from 'GmdVizPanel/config/query-resolutions';

import { getPercentilesQueryRunnerParams } from '../getPercentilesQueryRunnerParams';

describe('getPercentilesQueryRunnerParams(options)', () => {
  test('handles gauge metrics', () => {
    const result = getPercentilesQueryRunnerParams({
      metric: 'go_goroutines',
      histogramType: 'none',
      queryConfig: {
        resolution: QUERY_RESOLUTION.HIGH,
        labelMatchers: [{ key: 'instance', operator: '=', value: 'us-east:5000' }],
        addIgnoreUsageFilter: true,
        queries: [{ fn: 'quantile', params: { percentiles: [99, 90] } }],
      },
    });

    expect(result.isRateQuery).toBe(false);
    expect(result.maxDataPoints).toBe(500);
    expect(result.queries).toStrictEqual([
      {
        refId: 'go_goroutines-p99-quantile',
        expr: 'quantile(0.99, go_goroutines{instance="us-east:5000", __ignore_usage__="", ${filters}})',
        legendFormat: '99th Percentile',
        fromExploreMetrics: true,
      },
      {
        refId: 'go_goroutines-p90-quantile',
        expr: 'quantile(0.9, go_goroutines{instance="us-east:5000", __ignore_usage__="", ${filters}})',
        legendFormat: '90th Percentile',
        fromExploreMetrics: true,
      },
    ]);
  });

  test('handles counter metrics', () => {
    const result = getPercentilesQueryRunnerParams({
      metric: 'go_gc_heap_frees_bytes_total',
      histogramType: 'none',
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [{ key: 'job', operator: '!=', value: 'prometheus' }],
        addIgnoreUsageFilter: true,
        queries: [{ fn: 'quantile', params: { percentiles: [99, 50] } }],
      },
    });

    expect(result.isRateQuery).toBe(true);
    expect(result.maxDataPoints).toBe(250);
    expect(result.queries).toStrictEqual([
      {
        refId: 'go_gc_heap_frees_bytes_total-p99-quantile(rate)',
        expr: 'quantile(0.99, rate(go_gc_heap_frees_bytes_total{job!="prometheus", __ignore_usage__="", ${filters}}[$__rate_interval]))',
        legendFormat: '99th Percentile',
        fromExploreMetrics: true,
      },
      {
        refId: 'go_gc_heap_frees_bytes_total-p50-quantile(rate)',
        expr: 'quantile(0.5, rate(go_gc_heap_frees_bytes_total{job!="prometheus", __ignore_usage__="", ${filters}}[$__rate_interval]))',
        legendFormat: '50th Percentile',
        fromExploreMetrics: true,
      },
    ]);
  });

  test('handles native histogram metrics', () => {
    const result = getPercentilesQueryRunnerParams({
      metric: 'grafana_database_all_migrations_duration_seconds',
      histogramType: 'native',
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [{ key: 'success', operator: '=', value: 'true' }],
        addIgnoreUsageFilter: true,
        queries: [{ fn: 'histogram_quantile', params: { percentiles: [50] } }],
      },
    });

    expect(result.isRateQuery).toBe(true);
    expect(result.maxDataPoints).toBe(250);
    expect(result.queries).toStrictEqual([
      {
        refId: 'grafana_database_all_migrations_duration_seconds-p50-histogram_quantile',
        expr: 'histogram_quantile(0.5,sum(rate(grafana_database_all_migrations_duration_seconds{success="true", __ignore_usage__="", ${filters}}[$__rate_interval])))',
        legendFormat: '50th Percentile',
        fromExploreMetrics: true,
      },
    ]);
  });

  test('handles non-native ("classic") histogram metrics', () => {
    const result = getPercentilesQueryRunnerParams({
      metric: 'go_gc_heap_allocs_by_size_bytes_bucket',
      histogramType: 'classic',
      queryConfig: {
        resolution: QUERY_RESOLUTION.HIGH,
        labelMatchers: [{ key: 'success', operator: '=', value: 'true' }],
        addIgnoreUsageFilter: true,
        queries: [{ fn: 'histogram_quantile', params: { percentiles: [75] } }],
      },
    });

    expect(result.isRateQuery).toBe(true);
    expect(result.maxDataPoints).toBe(500);
    expect(result.queries).toStrictEqual([
      {
        refId: 'go_gc_heap_allocs_by_size_bytes_bucket-p75-histogram_quantile',
        expr: 'histogram_quantile(0.75,sum by (le) (rate(go_gc_heap_allocs_by_size_bytes_bucket{success="true", __ignore_usage__="", ${filters}}[$__rate_interval])))',
        legendFormat: '75th Percentile',
        fromExploreMetrics: true,
      },
    ]);
  });
});
