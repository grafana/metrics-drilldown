import { getBackendSrv } from '@grafana/runtime';

import { fetchDashboardMetrics } from '../fetchDashboardMetrics';

jest.mock('@grafana/runtime');

function setup() {
  const get = jest.fn(async () => ({}));
  (getBackendSrv as jest.Mock).mockImplementation(() => ({ get }));
  return { get };
}

describe('fetchDashboardMetrics()', () => {
  test('searches for at most 500 dashboards in DB', async () => {
    const { get } = setup();

    await fetchDashboardMetrics();

    expect(get).toHaveBeenCalledWith(
      '/api/search',
      { type: 'dash-db', limit: 500 },
      expect.any(String),
      expect.any(Object)
    );
  });

  describe('after receiving the list of dashboards', () => {
    test('fetches each individual dashboard data', async () => {
      const { get } = setup();

      get.mockResolvedValueOnce([
        { uid: 42, url: 'http://42.test.com' },
        { uid: 2025, url: 'http://2025.test.com' },
      ]);

      await fetchDashboardMetrics();

      expect(get).toHaveBeenCalledTimes(3);
      expect(get).toHaveBeenCalledWith('/api/dashboards/uid/2025', undefined, expect.any(String), expect.any(Object));
      expect(get).toHaveBeenCalledWith('/api/dashboards/uid/42', undefined, expect.any(String), expect.any(Object));
    });

    test('parses each dashboard received to compute metric counts', async () => {
      const { get } = setup();

      get.mockResolvedValueOnce([
        { uid: 42, url: 'http://42.test.com' },
        { uid: 2025, url: 'http://2025.test.com' },
      ]);

      const promDatasource = { type: 'prometheus', uid: 'test-prom-ds' };
      const nonPromDatasource = { type: 'pyroscope', uid: 'test-profiles-ds' };

      get.mockResolvedValueOnce({
        dashboard: {
          uid: 2025,
          url: 'http://2025.test.com',
          title: 'Year 2025',
          panels: [
            {
              datasource: promDatasource,
              targets: [{ expr: 'memcached_up{}' }, { expr: 'go_goroutines{}' }],
            },
          ],
        },
      });
      get.mockResolvedValueOnce({
        dashboard: {
          uid: 42,
          url: 'http://42.test.com',
          panels: [{ datasource: promDatasource, targets: [{ expr: 'go_goroutines{cluster="test"}' }] }],
        },
      });
      get.mockResolvedValueOnce({
        dashboard: {
          uid: -1,
          url: 'http://no.test.com',
          panels: [{ datasource: nonPromDatasource, targets: [{ expr: '{service_name="ingester"}' }] }],
        },
      });
      get.mockResolvedValueOnce({ dashboard: { uid: -2, url: 'http://no.test.com', panels: [] } });

      const result = await fetchDashboardMetrics();

      expect(result).toEqual({
        go_goroutines: {
          usageType: 'dashboard-usage',
          count: 2,
          dashboards: {
            'Year 2025': {
              count: 1,
              uid: 2025,
              url: 'http://42.test.com',
            },
            'Dashboard 42': {
              count: 1,
              uid: 42,
              url: 'http://2025.test.com',
            },
          },
        },
        memcached_up: {
          usageType: 'dashboard-usage',
          count: 1,
          dashboards: {
            'Year 2025': {
              count: 1,
              uid: 2025,
              url: 'http://42.test.com',
            },
          },
        },
      });
    });
  });
});
