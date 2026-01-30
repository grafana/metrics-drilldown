import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';

import { DataSourceFetcher, isPrometheusDataSource } from './utils.datasource';

jest.mock('@grafana/runtime');

describe('isPrometheusDataSource', () => {
  it('should return true for a core Prometheus datasource', () => {
    const ds = { type: 'prometheus', uid: 'prometheus' };
    expect(isPrometheusDataSource(ds)).toBe(true);
  });

  it('should return true for a Grafana developed Prometheus datasource', () => {
    const ds = { type: 'grafana-amazonprometheus-datasource', uid: 'grafana-amazonprometheus-datasource' };
    expect(isPrometheusDataSource(ds)).toBe(true);
  });

  it('should return false for non-Prometheus datasource', () => {
    const ds = { type: 'grafana-test-datasource', uid: 'grafana-test-datasource' };
    expect(isPrometheusDataSource(ds)).toBe(false);
  });

  it('should return false for object without type property', () => {
    const ds = { name: 'prometheus', uid: 'prometheus' };
    expect(isPrometheusDataSource(ds)).toBe(false);
  });
});

describe('DataSourceFetcher', () => {
  const mockDataSources = [
    { uid: 'ds1', name: 'Loki 1', type: 'loki', isDefault: true },
    { uid: 'ds2', name: 'Loki 2', type: 'loki', isDefault: false },
    { uid: 'ds3', name: 'Loki 3', type: 'loki', isDefault: false },
  ];

  let mockGetBackendSrv: jest.MockedFunction<typeof getBackendSrv>;
  let mockGetDataSourceSrv: jest.MockedFunction<typeof getDataSourceSrv>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockGetBackendSrv = getBackendSrv as jest.MockedFunction<typeof getBackendSrv>;
    mockGetDataSourceSrv = getDataSourceSrv as jest.MockedFunction<typeof getDataSourceSrv>;

    mockGetDataSourceSrv.mockReturnValue({
      getList: jest.fn().mockReturnValue(mockDataSources),
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const simulateSlowHealthCheck = (options: any) => {
    return new Promise((resolve, reject) => {
      // Simulate a slow response that will be aborted
      const timeout = setTimeout(() => resolve({ status: 'OK' }), 5000);

      // Listen for abort signal and reject with AbortError
      const abortHandler = () => {
        clearTimeout(timeout);
        const error = new DOMException('The operation was aborted.', 'AbortError');
        reject(error);
      };
      options.abortSignal?.addEventListener('abort', abortHandler);
    });
  };

  describe('getHealthyDataSources', () => {
    it('should return healthy data sources when health checks pass', async () => {
      mockGetBackendSrv.mockReturnValue({
        get: jest.fn().mockResolvedValue({ status: 'OK' }),
      } as any);

      const fetcher = new DataSourceFetcher();
      const result = await fetcher.getHealthyDataSources('loki');

      expect(result).toEqual(mockDataSources);
      expect(mockGetBackendSrv().get).toHaveBeenCalledTimes(3);
    });

    it('should filter out unhealthy data sources', async () => {
      mockGetBackendSrv.mockReturnValue({
        get: jest.fn().mockImplementation((url: string) => {
          if (url.includes('ds1')) {
            return Promise.resolve({ status: 'OK' });
          }
          return Promise.resolve({ status: 'ERROR' });
        }),
      } as any);

      const fetcher = new DataSourceFetcher();
      const result = await fetcher.getHealthyDataSources('loki');

      expect(result).toEqual([mockDataSources[0]]);
    });

    it('should handle health check timeouts by treating them as unhealthy', async () => {
      mockGetBackendSrv.mockReturnValue({
        get: jest.fn().mockImplementation((_url: string, _params: any, _id: any, options: any) => {
          return simulateSlowHealthCheck(options);
        }),
      } as any);

      const fetchPromise = new DataSourceFetcher().getHealthyDataSources('loki');

      // Fast-forward past the 3-second timeout
      jest.advanceTimersByTime(3000);

      const result = await fetchPromise;

      // All data sources should be filtered out due to timeout
      expect(result).toEqual([]);
    });

    it('should handle network errors by treating data sources as unhealthy', async () => {
      mockGetBackendSrv.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('Network error')),
      } as any);

      const fetcher = new DataSourceFetcher();
      const result = await fetcher.getHealthyDataSources('loki');

      expect(result).toEqual([]);
    });

    it('should cache results and not make duplicate requests', async () => {
      mockGetBackendSrv.mockReturnValue({
        get: jest.fn().mockResolvedValue({ status: 'OK' }),
      } as any);

      const fetcher = new DataSourceFetcher();

      // First call
      const result1 = await fetcher.getHealthyDataSources('loki');
      expect(result1).toEqual(mockDataSources);

      // Second call should use cache
      const result2 = await fetcher.getHealthyDataSources('loki');
      expect(result2).toEqual(mockDataSources);

      // Should only have called the backend once per data source
      expect(mockGetBackendSrv().get).toHaveBeenCalledTimes(3);
    });

    it('should sort data sources with default first', async () => {
      const unsortedDataSources = [
        { uid: 'ds1', name: 'Loki 1', type: 'loki', isDefault: false },
        { uid: 'ds2', name: 'Loki 2', type: 'loki', isDefault: true },
        { uid: 'ds3', name: 'Loki 3', type: 'loki', isDefault: false },
      ];

      mockGetDataSourceSrv.mockReturnValue({
        getList: jest.fn().mockReturnValue(unsortedDataSources),
      } as any);

      mockGetBackendSrv.mockReturnValue({
        get: jest.fn().mockResolvedValue({ status: 'OK' }),
      } as any);

      const fetcher = new DataSourceFetcher();
      const result = await fetcher.getHealthyDataSources('loki');

      // Default data source (ds2) should be first
      expect(result[0].uid).toBe('ds2');
      expect(result[0].isDefault).toBe(true);
    });

    it('should pass correct parameters to health check endpoint', async () => {
      const mockGet = jest.fn().mockResolvedValue({ status: 'OK' });
      mockGetBackendSrv.mockReturnValue({
        get: mockGet,
      } as any);

      const fetcher = new DataSourceFetcher();
      await fetcher.getHealthyDataSources('loki');

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/api/datasources/uid/'),
        undefined,
        undefined,
        expect.objectContaining({
          showSuccessAlert: false,
          showErrorAlert: false,
          abortSignal: expect.any(AbortSignal),
        })
      );
    });
  });
});
