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

  describe('with KG metricType override', () => {
    it('returns mapped type when kgMetricType is set, skipping heuristic', () => {
      expect(getMetricTypeSync('my_recording_rule', 'counter')).toBe('counter');
    });

    it('maps histogram to classic-histogram', () => {
      expect(getMetricTypeSync('my_recording_rule', 'histogram')).toBe('classic-histogram');
    });

    it('maps summary to summary', () => {
      expect(getMetricTypeSync('my_recording_rule', 'summary')).toBe('summary');
    });

    it('overrides heuristic completely — counter metric becomes gauge with KG override', () => {
      expect(getMetricTypeSync('http_requests_total', 'gauge')).toBe('gauge');
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
    it.each([
      { metric: 'memory_usage_bytes', metadataType: 'histogram', expected: 'native-histogram' },
      { metric: 'memory_usage_bytes', metadataType: 'counter', expected: 'counter' },
      { metric: 'http_requests_total', metadataType: 'gauge', expected: 'gauge' },
      { metric: 'memory_usage_bytes', metadataType: 'summary', expected: 'summary' },
    ])('returns "$expected" for $metric with metadata type $metadataType', async ({ metric, metadataType, expected }) => {
      const dataTrail = createMockDataTrail(metadataType);

      const result = await getMetricType(metric, dataTrail);

      expect(result).toBe(expected);
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
    it.each([
      { metric: 'request_duration_bucket', expected: 'classic-histogram' },
      { metric: 'up', expected: 'status-updown' },
      { metric: 'node_info', expected: 'info' },
      { metric: 'process_start_timestamp_seconds', expected: 'age' },
    ])('returns "$expected" without checking metadata', async ({ metric, expected }) => {
      const dataTrail = createMockDataTrail('gauge');

      const result = await getMetricType(metric, dataTrail);

      expect(result).toBe(expected);
      expect(dataTrail.getMetadataForMetric).not.toHaveBeenCalled();
    });
  });

  describe('with KG metricType override', () => {
    it.each([
      { name: 'returns mapped type immediately without metadata fetch', heuristic: 'gauge', override: 'counter', expected: 'counter' },
      { name: 'maps histogram to classic-histogram without metadata fetch', heuristic: 'histogram', override: 'histogram', expected: 'classic-histogram' },
      { name: 'maps summary to summary without metadata fetch', heuristic: 'counter', override: 'summary', expected: 'summary' },
    ] as const)('$name', async ({ heuristic, override, expected }) => {
      const dataTrail = createMockDataTrail(heuristic);

      const result = await getMetricType('my_recording_rule', dataTrail, override);

      expect(result).toBe(expected);
      expect(dataTrail.getMetadataForMetric).not.toHaveBeenCalled();
    });
  });
});
