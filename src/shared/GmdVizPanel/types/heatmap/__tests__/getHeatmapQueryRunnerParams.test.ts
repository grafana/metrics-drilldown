import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';

import { getHeatmapQueryRunnerParams } from '../getHeatmapQueryRunnerParams';

describe('getHeatmapQueryRunnerParams(options)', () => {
  test('builds a heatmap query aggregated by le', () => {
    const result = getHeatmapQueryRunnerParams({
      metric: { name: 'grafana_database_all_migrations_duration_seconds', type: 'classic-histogram' },
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
        expr: 'sum by (le) (rate(grafana_database_all_migrations_duration_seconds{success="true", __ignore_usage__="", ${filters:raw}}[$__rate_interval]))',
        format: 'heatmap',
        fromExploreMetrics: true,
      },
    ]);
  });
});
