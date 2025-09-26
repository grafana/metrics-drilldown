import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';

import { getStatushistoryQueryRunnerParams } from '../getStatushistoryQueryRunnerParams';

test('getStatushistoryQueryRunnerParams(options)', () => {
  const result = getStatushistoryQueryRunnerParams({
    metric: { name: 'memcached_up', type: 'status-updown' },
    queryConfig: {
      resolution: QUERY_RESOLUTION.HIGH,
      labelMatchers: [{ key: 'cluster', operator: '=', value: 'prod' }],
      addIgnoreUsageFilter: true,
      queries: [],
    },
  });

  expect(result.maxDataPoints).toBe(200);
  expect(result.queries).toStrictEqual([
    {
      refId: 'memcached_up-status',
      expr: 'min(memcached_up{cluster="prod", __ignore_usage__="", ${filters:raw}})',
      legendFormat: 'status',
      fromExploreMetrics: true,
    },
  ]);
});
