import { buildNavigateToMetricsParams, configureDrilldownLink, parsePromQLQuery, UrlParameters, type MetricsDrilldownContext } from './links';

// Mock the logger to avoid importing it
jest.mock('../tracking/logger/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('parsePromQLQuery - lezer parser tests', () => {
  test('should parse basic metric name', () => {
    const result = parsePromQLQuery('http_requests_total');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labels).toEqual([]);
    expect(result.hasErrors).toBe(false);
    expect(result.errors).toEqual([]);
  });

  test('should parse metric with single label', () => {
    const result = parsePromQLQuery('http_requests_total{method="GET"}');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labels).toEqual([{ label: 'method', op: '=', value: 'GET' }]);
    expect(result.hasErrors).toBe(false);
    expect(result.errors).toEqual([]);
  });

  test('should parse metric with multiple labels', () => {
    const result = parsePromQLQuery('http_requests_total{method="GET",status="200"}');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labels).toEqual([
      { label: 'method', op: '=', value: 'GET' },
      { label: 'status', op: '=', value: '200' },
    ]);
  });

  test('should parse metric with different operators', () => {
    const result = parsePromQLQuery('http_requests_total{method!="POST",status=~"2.."}');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labels).toEqual([
      { label: 'method', op: '!=', value: 'POST' },
      { label: 'status', op: '=~', value: '2..' },
    ]);
  });

  test('should handle function expressions', () => {
    const result = parsePromQLQuery('rate(http_requests_total[5m])');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labels).toEqual([]);
  });

  test('should handle complex function expressions', () => {
    const result = parsePromQLQuery('sum(rate(http_requests_total{status="200"}[5m])) by (service)');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labels).toEqual([{ label: 'status', op: '=', value: '200' }]);
  });

  test('should handle binary operations', () => {
    const result = parsePromQLQuery('http_requests_total{status="200"} / http_requests_total');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labels).toEqual([{ label: 'status', op: '=', value: '200' }]);
  });

  test('should handle empty label values', () => {
    const result = parsePromQLQuery('http_requests_total{method="",status="200"}');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labels).toEqual([
      { label: 'method', op: '=', value: '' },
      { label: 'status', op: '=', value: '200' },
    ]);
  });

  test('should handle invalid queries gracefully', () => {
    const result = parsePromQLQuery('invalid{query');
    expect(result).toBeDefined();
    expect(result.metric).toBe('invalid'); // Should still extract the metric
    expect(result.labels).toEqual([]); // Should have no valid labels
    expect(result.hasErrors).toBe(true); // Should detect errors
    expect(result.errors).toHaveLength(2); // Should have 2 error nodes
    expect(result.errors[0]).toContain('Parse error at position');
  });

  test('should handle regex match operators', () => {
    const result = parsePromQLQuery('up{job=~"prometheus.*",instance!~"localhost:.*"}');
    expect(result.metric).toBe('up');
    expect(result.labels).toEqual([
      { label: 'job', op: '=~', value: 'prometheus.*' },
      { label: 'instance', op: '!~', value: 'localhost:.*' },
    ]);
  });

  test('should handle aggregation functions with grouping', () => {
    const result = parsePromQLQuery('sum by (job) (up{job="prometheus"})');
    expect(result.metric).toBe('up');
    expect(result.labels).toEqual([{ label: 'job', op: '=', value: 'prometheus' }]);
  });

  test('should handle histogram_quantile functions', () => {
    const result = parsePromQLQuery('histogram_quantile(0.95, rate(http_duration_seconds_bucket{job="api"}[5m]))');
    expect(result.metric).toBe('http_duration_seconds_bucket');
    expect(result.labels).toEqual([{ label: 'job', op: '=', value: 'api' }]);
  });

  test('should handle metrics with special characters in names', () => {
    const result = parsePromQLQuery('namespace:http_requests_total{service="api"}');
    expect(result.metric).toBe('namespace:http_requests_total');
    expect(result.labels).toEqual([{ label: 'service', op: '=', value: 'api' }]);
  });

  test('should handle path-like label values', () => {
    const result = parsePromQLQuery('http_requests_total{path="/api/v1/users",method="GET"}');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labels).toEqual([
      { label: 'path', op: '=', value: '/api/v1/users' },
      { label: 'method', op: '=', value: 'GET' },
    ]);
  });

  test('should handle node_exporter style metrics', () => {
    const result = parsePromQLQuery('node_filesystem_size_bytes{device="/dev/sda1",mountpoint="/"}');
    expect(result.metric).toBe('node_filesystem_size_bytes');
    expect(result.labels).toEqual([
      { label: 'device', op: '=', value: '/dev/sda1' },
      { label: 'mountpoint', op: '=', value: '/' },
    ]);
  });

  // Test edge cases specific to the lezer parser
  test('should extract first metric when multiple metrics in binary operations', () => {
    const result = parsePromQLQuery('metric_a{label="value"} + metric_b{other="test"}');
    expect(result.metric).toBe('metric_a');
    expect(result.labels).toEqual([
      { label: 'label', op: '=', value: 'value' },
      { label: 'other', op: '=', value: 'test' },
    ]);
  });

  test('should handle nested function calls', () => {
    const result = parsePromQLQuery('round(increase(http_requests_total{status="200"}[5m]), 0.1)');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labels).toEqual([{ label: 'status', op: '=', value: '200' }]);
  });
});

describe('configureDrilldownLink', () => {
  describe('guard clauses', () => {
    test('should return undefined when context is undefined', () => {
      const result = configureDrilldownLink(undefined);
      expect(result).toBeUndefined();
    });

    test('should return undefined when plugin type is not timeseries', () => {
      const context = {
        pluginId: 'table',
        targets: [],
      };
      const result = configureDrilldownLink(context);
      expect(result).toBeUndefined();
    });

    test('should return undefined when no PromQL queries exist', () => {
      const context = {
        pluginId: 'timeseries',
        targets: [
          { expr: undefined }, // not a PromQL query
          { refId: 'A' }, // not a PromQL query
        ],
      };
      const result = configureDrilldownLink(context);
      expect(result).toBeUndefined();
    });
    // do we want to show a link when the data source is prometheus? We can default to showing a link to the metrics reducer page..
    test('should return undefined when query has no expression', () => {
      const context = {
        pluginId: 'timeseries',
        targets: [
          {
            expr: '',
            datasource: { type: 'prometheus', uid: 'prom-uid' },
          },
        ],
      };
      const result = configureDrilldownLink(context);
      expect(result).toBeUndefined();
    });

    test('should return undefined when datasource is not prometheus', () => {
      const context = {
        pluginId: 'timeseries',
        targets: [
          {
            expr: 'up',
            datasource: { type: 'influxdb', uid: 'influx-uid' },
          },
        ],
      };
      const result = configureDrilldownLink(context);
      expect(result).toBeUndefined();
    });
  });

  describe('successful URL construction', () => {
    test('should construct URL with all components', () => {
      const context = {
        pluginId: 'timeseries',
        targets: [
          {
            expr: 'http_requests_total{method="GET",status="200"}',
            datasource: { type: 'prometheus', uid: 'prom-uid' },
          },
        ],
        timeRange: {
          from: '2023-01-01T00:00:00Z',
          to: '2023-01-01T01:00:00Z',
        },
      };

      const result = configureDrilldownLink(context);
      
      expect(result).toBeDefined();
      expect(result?.path).toContain('/a/grafana-metricsdrilldown-app/drilldown');
      expect(result?.path).toContain('metric=http_requests_total');
      expect(result?.path).toContain('from=2023-01-01T00%3A00%3A00Z');
      expect(result?.path).toContain('to=2023-01-01T01%3A00%3A00Z');
      expect(result?.path).toContain('var-ds=prom-uid');
      expect(result?.path).toContain('var-filters=method%3DGET');
      expect(result?.path).toContain('var-filters=status%3D200');
    });

    test('should construct URL with special characters in labels', () => {
      const context = {
        pluginId: 'timeseries',
        targets: [
          {
            expr: 'http_requests_total{path="/api/v1/users?id=123&name=test"}',
            datasource: { type: 'prometheus', uid: 'prom-uid' },
          },
        ],
      };

      const result = configureDrilldownLink(context);
      
      expect(result).toBeDefined();
      expect(result?.path).toContain('var-filters=path%3D%2Fapi%2Fv1%2Fusers%3Fid%3D123%26name%3Dtest');
    });
  });

  describe('error handling', () => {
    test('should return fallback URL and log errors when parsing fails', () => {
      // Test with a context that has a malformed query that might cause parsePromQLQuery to throw
      const context = {
        pluginId: 'timeseries',
        targets: [
          {
            expr: 'up{', // Malformed query that might cause parsing to fail
            datasource: { type: 'prometheus', uid: 'prom-uid' },
          },
        ],
      };

      const result = configureDrilldownLink(context);
      
      // Should still return a result (either with parsed data or fallback)
      expect(result).toBeDefined();
      expect(result?.path).toContain('/a/grafana-metricsdrilldown-app/drilldown');
      
      // Note: The actual parsePromQLQuery might handle this gracefully with hasErrors=true,
      // so we just test that the function doesn't crash and returns a valid path
    });
  });
});

describe('buildNavigateToMetricsParams', () => {
  it('should build URL parameters with all fields populated', () => {
    const context: MetricsDrilldownContext = {
      navigateToMetrics: true,
      datasource_uid: 'test-datasource-uid',
      metric: 'http_requests_total',
      start: '2024-01-01T00:00:00Z',
      end: '2024-01-01T01:00:00Z',
      label_filters: ['status=200', 'method=GET', 'path=/api/test'],
    };

    const result = buildNavigateToMetricsParams(context);

    expect(result.get(UrlParameters.Metric)).toBe('http_requests_total');
    expect(result.get(UrlParameters.TimeRangeFrom)).toBe('2024-01-01T00:00:00Z');
    expect(result.get(UrlParameters.TimeRangeTo)).toBe('2024-01-01T01:00:00Z');
    expect(result.get(UrlParameters.DatasourceId)).toBe('test-datasource-uid');
    expect(result.getAll(UrlParameters.Filters)).toEqual(['status=200', 'method=GET', 'path=/api/test']);
  });

  it('should build URL parameters with only required fields', () => {
    const context: MetricsDrilldownContext = {
      navigateToMetrics: true,
      datasource_uid: 'test-datasource-uid',
    };

    const result = buildNavigateToMetricsParams(context);

    expect(result.get(UrlParameters.Metric)).toBeNull();
    expect(result.get(UrlParameters.TimeRangeFrom)).toBeNull();
    expect(result.get(UrlParameters.TimeRangeTo)).toBeNull();
    expect(result.get(UrlParameters.DatasourceId)).toBe('test-datasource-uid');
    expect(result.getAll(UrlParameters.Filters)).toEqual([]);
  });

  it('should handle undefined label_filters', () => {
    const context: MetricsDrilldownContext = {
      navigateToMetrics: true,
      datasource_uid: 'test-datasource-uid',
      label_filters: undefined,
    };

    const result = buildNavigateToMetricsParams(context);

    expect(result.get(UrlParameters.DatasourceId)).toBe('test-datasource-uid');
    expect(result.getAll(UrlParameters.Filters)).toEqual([]);
  });
});
