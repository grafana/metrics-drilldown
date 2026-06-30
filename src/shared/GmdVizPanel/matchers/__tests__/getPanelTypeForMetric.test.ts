import { type DataTrail } from 'AppDataTrail/DataTrail';

import { getPanelTypeForMetric, getPanelTypeForMetricSync } from '../getPanelTypeForMetric';

describe('getPanelTypeForMetricSync(metric)', () => {
  describe('heatmap panels', () => {
    test.each([['request_duration_bucket'], ['http_request_size_bucket']])('returns "heatmap" for %s', (metric) => {
      expect(getPanelTypeForMetricSync(metric)).toBe('heatmap');
    });
  });

  describe('statushistory panels', () => {
    test.each([['up'], ['node_exporter_up'], ['memcached_up']])('returns "statushistory" for %s', (metric) => {
      expect(getPanelTypeForMetricSync(metric)).toBe('statushistory');
    });
  });

  describe('timeseries panels (default)', () => {
    test.each([
      ['http_requests_total', 'counter'],
      ['http_requests_count', 'counter'],
      ['request_duration_sum', 'counter'],
      ['process_start_timestamp_seconds', 'age'],
      ['memory_usage_bytes', 'gauge'],
      ['cpu_usage_percent', 'gauge'],
      ['node_info', 'info'],
    ])('returns "timeseries" for %s (%s)', (metric) => {
      expect(getPanelTypeForMetricSync(metric)).toBe('timeseries');
    });
  });
});

describe('getPanelTypeForMetric(metric, dataTrail)', () => {
  const createMockDataTrail = (metadataType?: string) => {
    return {
      getMetadataForMetric: jest.fn().mockResolvedValue(metadataType ? { type: metadataType } : undefined),
    } as unknown as DataTrail;
  };

  describe('heatmap panels', () => {
    it('returns "heatmap" for classic histogram metrics', async () => {
      const dataTrail = createMockDataTrail();

      const result = await getPanelTypeForMetric('request_duration_bucket', dataTrail);

      expect(result).toBe('heatmap');
    });

    it('returns "heatmap" for native histogram metrics (metadata says histogram)', async () => {
      const dataTrail = createMockDataTrail('histogram');

      const result = await getPanelTypeForMetric('memory_usage_bytes', dataTrail);

      expect(result).toBe('heatmap');
    });
  });

  describe('statushistory panels', () => {
    it('returns "statushistory" for status up/down metrics', async () => {
      const dataTrail = createMockDataTrail();

      const result = await getPanelTypeForMetric('up', dataTrail);

      expect(result).toBe('statushistory');
    });

    it('returns "statushistory" for metrics ending with _up', async () => {
      const dataTrail = createMockDataTrail();

      const result = await getPanelTypeForMetric('node_exporter_up', dataTrail);

      expect(result).toBe('statushistory');
    });
  });

  describe('timeseries panels', () => {
    it('returns "timeseries" for counter metrics', async () => {
      const dataTrail = createMockDataTrail();

      const result = await getPanelTypeForMetric('http_requests_total', dataTrail);

      expect(result).toBe('timeseries');
    });

    it('returns "timeseries" for age metrics', async () => {
      const dataTrail = createMockDataTrail();

      const result = await getPanelTypeForMetric('process_start_timestamp_seconds', dataTrail);

      expect(result).toBe('timeseries');
    });

    it('returns "timeseries" for gauge metrics', async () => {
      const dataTrail = createMockDataTrail();

      const result = await getPanelTypeForMetric('memory_usage_bytes', dataTrail);

      expect(result).toBe('timeseries');
    });

    it('returns "timeseries" for info metrics', async () => {
      const dataTrail = createMockDataTrail();

      const result = await getPanelTypeForMetric('node_info', dataTrail);

      expect(result).toBe('timeseries');
    });
  });

  describe('metadata overrides', () => {
    it('returns "timeseries" when gauge heuristic is overridden to counter by metadata', async () => {
      const dataTrail = createMockDataTrail('counter');

      const result = await getPanelTypeForMetric('memory_usage_bytes', dataTrail);

      expect(result).toBe('timeseries');
    });

    it('returns "timeseries" when counter heuristic is overridden to gauge by metadata', async () => {
      const dataTrail = createMockDataTrail('gauge');

      const result = await getPanelTypeForMetric('http_requests_total', dataTrail);

      expect(result).toBe('timeseries');
    });
  });

  describe('with KG metricType override', () => {
    it('returns "heatmap" when KG says histogram', async () => {
      const dataTrail = createMockDataTrail();

      const result = await getPanelTypeForMetric('my_recording_rule', dataTrail, 'histogram');

      expect(result).toBe('heatmap');
      expect(dataTrail.getMetadataForMetric).not.toHaveBeenCalled();
    });

    it('returns "timeseries" when KG says counter', async () => {
      const dataTrail = createMockDataTrail();

      const result = await getPanelTypeForMetric('my_recording_rule', dataTrail, 'counter');

      expect(result).toBe('timeseries');
      expect(dataTrail.getMetadataForMetric).not.toHaveBeenCalled();
    });

    it('returns "timeseries" when KG says gauge', async () => {
      const dataTrail = createMockDataTrail();

      const result = await getPanelTypeForMetric('my_recording_rule', dataTrail, 'gauge');

      expect(result).toBe('timeseries');
      expect(dataTrail.getMetadataForMetric).not.toHaveBeenCalled();
    });
  });
});

describe('getPanelTypeForMetricSync with KG override', () => {
  it('returns "heatmap" when KG says histogram', () => {
    expect(getPanelTypeForMetricSync('my_recording_rule', 'histogram')).toBe('heatmap');
  });

  it('returns "timeseries" when KG says counter', () => {
    expect(getPanelTypeForMetricSync('my_recording_rule', 'counter')).toBe('timeseries');
  });

  it('overrides suffix-based detection', () => {
    expect(getPanelTypeForMetricSync('request_duration_bucket', 'counter')).toBe('timeseries');
  });
});
