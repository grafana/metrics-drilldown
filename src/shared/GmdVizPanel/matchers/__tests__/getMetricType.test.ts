import { type DataTrail } from 'AppDataTrail/DataTrail';

import { getMetricType, getMetricTypeSync } from '../getMetricType';

describe('getMetricTypeSync(metric)', () => {
  describe('counter metrics', () => {
    test.each([['http_requests_total'], ['http_requests_count'], ['request_duration_sum']])(
      'returns "counter" for %s',
      (metric) => {
        expect(getMetricTypeSync(metric)).toBe('counter');
      }
    );
  });

  describe('classic-histogram metrics', () => {
    test.each([['request_duration_bucket'], ['http_request_size_bucket']])(
      'returns "classic-histogram" for %s',
      (metric) => {
        expect(getMetricTypeSync(metric)).toBe('classic-histogram');
      }
    );
  });

  describe('age metrics', () => {
    test.each([['process_start_timestamp_seconds'], ['node_boot_timestamp_seconds']])(
      'returns "age" for %s',
      (metric) => {
        expect(getMetricTypeSync(metric)).toBe('age');
      }
    );
  });

  describe('status-updown metrics', () => {
    test.each([['up'], ['node_exporter_up'], ['memcached_up']])('returns "status-updown" for %s', (metric) => {
      expect(getMetricTypeSync(metric)).toBe('status-updown');
    });
  });

  describe('info metrics', () => {
    test.each([['node_info'], ['application_info']])('returns "info" for %s', (metric) => {
      expect(getMetricTypeSync(metric)).toBe('info');
    });
  });

  describe('gauge metrics (default)', () => {
    test.each([['memory_usage_bytes'], ['cpu_usage_percent'], ['temperature_celsius']])(
      'returns "gauge" for %s',
      (metric) => {
        expect(getMetricTypeSync(metric)).toBe('gauge');
      }
    );
  });

  describe('priority ordering', () => {
    it('returns "counter" for metrics ending with _bucket_total (counter takes precedence)', () => {
      // Counter suffixes are checked before histogram suffixes
      expect(getMetricTypeSync('histogram_bucket_total')).toBe('counter');
    });

    it('returns "counter" for metrics ending with _bucket_count', () => {
      expect(getMetricTypeSync('histogram_bucket_count')).toBe('counter');
    });

    it('returns "counter" for metrics ending with _bucket_sum', () => {
      expect(getMetricTypeSync('histogram_bucket_sum')).toBe('counter');
    });
  });
});

describe('getMetricType(metric, dataTrail)', () => {
  const createMockDataTrail = (metadataType?: string) => {
    return {
      getMetadataForMetric: jest.fn().mockResolvedValue(metadataType ? { type: metadataType } : undefined),
    } as unknown as DataTrail;
  };

  describe('when metadata overrides heuristics', () => {
    it('returns "native-histogram" when heuristic is gauge but metadata type is histogram', async () => {
      const dataTrail = createMockDataTrail('histogram');

      const result = await getMetricType('memory_usage_bytes', dataTrail);

      expect(result).toBe('native-histogram');
    });

    it('returns "counter" when heuristic is gauge but metadata type is counter', async () => {
      const dataTrail = createMockDataTrail('counter');

      const result = await getMetricType('memory_usage_bytes', dataTrail);

      expect(result).toBe('counter');
    });

    it('returns "gauge" when heuristic is counter but metadata type is gauge', async () => {
      const dataTrail = createMockDataTrail('gauge');

      const result = await getMetricType('http_requests_total', dataTrail);

      expect(result).toBe('gauge');
    });
  });

  describe('when metadata is unavailable', () => {
    it('falls back to sync heuristic result for gauge metrics', async () => {
      const dataTrail = createMockDataTrail();

      const result = await getMetricType('memory_usage_bytes', dataTrail);

      expect(result).toBe('gauge');
    });

    it('falls back to sync heuristic result for counter metrics', async () => {
      const dataTrail = createMockDataTrail();

      const result = await getMetricType('http_requests_total', dataTrail);

      expect(result).toBe('counter');
    });
  });

  describe('when metadata matches heuristics', () => {
    it('returns "counter" when both heuristic and metadata agree', async () => {
      const dataTrail = createMockDataTrail('counter');

      const result = await getMetricType('http_requests_total', dataTrail);

      expect(result).toBe('counter');
    });

    it('returns "gauge" when both heuristic and metadata agree', async () => {
      const dataTrail = createMockDataTrail('gauge');

      const result = await getMetricType('memory_usage_bytes', dataTrail);

      expect(result).toBe('gauge');
    });
  });

  describe('when heuristic is not gauge or counter', () => {
    it('returns "classic-histogram" without checking metadata', async () => {
      const dataTrail = createMockDataTrail('gauge');

      const result = await getMetricType('request_duration_bucket', dataTrail);

      expect(result).toBe('classic-histogram');
      expect(dataTrail.getMetadataForMetric).not.toHaveBeenCalled();
    });

    it('returns "status-updown" without checking metadata', async () => {
      const dataTrail = createMockDataTrail('gauge');

      const result = await getMetricType('up', dataTrail);

      expect(result).toBe('status-updown');
      expect(dataTrail.getMetadataForMetric).not.toHaveBeenCalled();
    });

    it('returns "info" without checking metadata', async () => {
      const dataTrail = createMockDataTrail('gauge');

      const result = await getMetricType('node_info', dataTrail);

      expect(result).toBe('info');
      expect(dataTrail.getMetadataForMetric).not.toHaveBeenCalled();
    });

    it('returns "age" without checking metadata', async () => {
      const dataTrail = createMockDataTrail('gauge');

      const result = await getMetricType('process_start_timestamp_seconds', dataTrail);

      expect(result).toBe('age');
      expect(dataTrail.getMetadataForMetric).not.toHaveBeenCalled();
    });
  });
});
