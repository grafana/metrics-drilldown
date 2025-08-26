import { QUERY_RESOLUTION } from 'GmdVizPanel/config/query-resolutions';

import { getHeatmapQueryRunnerParams } from '../getHeatmapQueryRunnerParams';

describe('getHeatmapQueryRunnerParams(options)', () => {
  test('handles native histogram metrics', () => {
    const result = getHeatmapQueryRunnerParams({
      metric: 'grafana_database_all_migrations_duration_seconds',
      isNativeHistogram: true,
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [{ key: 'success', operator: '=', value: 'true' }],
        addIgnoreUsageFilter: true,
      },
    });

    expect(result.maxDataPoints).toBe(250);
    expect(result.queries).toStrictEqual([
      {
        refId: 'grafana_database_all_migrations_duration_seconds-heatmap',
        expr: 'sum(rate(grafana_database_all_migrations_duration_seconds{success="true", __ignore_usage__="", ${filters}}[$__rate_interval]))',
        format: 'heatmap',
        fromExploreMetrics: true,
      },
    ]);
  });

  test('handles non-native histogram metrics', () => {
    const result = getHeatmapQueryRunnerParams({
      metric: 'go_gc_heap_allocs_by_size_bytes_bucket',
      isNativeHistogram: false,
      queryConfig: {
        resolution: QUERY_RESOLUTION.HIGH,
        labelMatchers: [{ key: 'success', operator: '=', value: 'true' }],
        addIgnoreUsageFilter: true,
      },
    });

    expect(result.maxDataPoints).toBe(500);
    expect(result.queries).toStrictEqual([
      {
        refId: 'go_gc_heap_allocs_by_size_bytes_bucket-heatmap',
        expr: 'sum by (le) (rate(go_gc_heap_allocs_by_size_bytes_bucket{success="true", __ignore_usage__="", ${filters}}[$__rate_interval]))',
        format: 'heatmap',
        fromExploreMetrics: true,
      },
    ]);
  });
});
