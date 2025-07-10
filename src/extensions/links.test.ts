import { ADHOC_URL_DELIMITER, buildNavigateToMetricsParams, parsePromQueryRegex, UrlParameters, type MetricsDrilldownContext } from './links';

describe('parsePromQueryRegex', () => {
  test('should parse basic metric name', () => {
    const result = parsePromQueryRegex('http_requests_total');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labelFilters).toEqual([]);
  });

  test('should parse metric with single label', () => {
    const result = parsePromQueryRegex('http_requests_total{method="GET"}');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labelFilters).toEqual([{ label: 'method', op: '=', value: 'GET' }]);
  });

  test('should parse metric with multiple labels', () => {
    const result = parsePromQueryRegex('http_requests_total{method="GET",status="200"}');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labelFilters).toEqual([
      { label: 'method', op: '=', value: 'GET' },
      { label: 'status', op: '=', value: '200' },
    ]);
  });

  test('should parse metric with different operators', () => {
    const result = parsePromQueryRegex('http_requests_total{method!="POST",status=~"2.."}');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labelFilters).toEqual([
      { label: 'method', op: '!=', value: 'POST' },
      { label: 'status', op: '=~', value: '2..' },
    ]);
  });

  test('should handle escaped quotes in label values', () => {
    const result = parsePromQueryRegex('http_requests_total{path="/api/v1/users",method="GET"}');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labelFilters).toEqual([
      { label: 'path', op: '=', value: '/api/v1/users' },
      { label: 'method', op: '=', value: 'GET' },
    ]);
  });

  test('should not treat function names as metrics', () => {
    const result = parsePromQueryRegex('rate(http_requests_total[5m])');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labelFilters).toEqual([]);
  });

  test('should handle complex function expressions', () => {
    const result = parsePromQueryRegex('sum(rate(http_requests_total{status="200"}[5m])) by (service)');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labelFilters).toEqual([{ label: 'status', op: '=', value: '200' }]);
  });

  test('should handle binary operations', () => {
    const result = parsePromQueryRegex('http_requests_total{status="200"} / http_requests_total');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labelFilters).toEqual([{ label: 'status', op: '=', value: '200' }]);
  });

  test('should handle metric names with underscores and colons', () => {
    const result = parsePromQueryRegex('namespace:http_requests_total{service="api"}');
    expect(result.metric).toBe('namespace:http_requests_total');
    expect(result.labelFilters).toEqual([{ label: 'service', op: '=', value: 'api' }]);
  });

  test('should handle empty label values', () => {
    const result = parsePromQueryRegex('http_requests_total{method="",status="200"}');
    expect(result.metric).toBe('http_requests_total');
    expect(result.labelFilters).toEqual([
      { label: 'method', op: '=', value: '' },
      { label: 'status', op: '=', value: '200' },
    ]);
  });

  test('should handle invalid queries gracefully', () => {
    const result = parsePromQueryRegex('invalid{query');
    expect(result.metric).toBe('invalid');
    expect(result.labelFilters).toEqual([]);
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

describe('URL Parameter Label Filter Formatting', () => {
  test('should format filter parameters with delimiter', () => {
    const mockLabelFilter = { label: 'method', op: '=', value: 'GET' };
    const formattedFilter = `${mockLabelFilter.label}${ADHOC_URL_DELIMITER}${mockLabelFilter.op}${ADHOC_URL_DELIMITER}${mockLabelFilter.value}`;
    
    expect(formattedFilter).toBe(`method${ADHOC_URL_DELIMITER}=${ADHOC_URL_DELIMITER}GET`);
  });

  test('should handle multiple filters with delimiter', () => {
    const mockLabelFilters = [
      { label: 'method', op: '=', value: 'GET' },
      { label: 'status', op: '!=', value: '404' },
      { label: 'path', op: '=~', value: '/api/.*' }
    ];
    
    const formattedFilters = mockLabelFilters.map(f => `${f.label}${ADHOC_URL_DELIMITER}${f.op}${ADHOC_URL_DELIMITER}${f.value}`);
    
    expect(formattedFilters).toEqual([
      `method${ADHOC_URL_DELIMITER}=${ADHOC_URL_DELIMITER}GET`,
      `status${ADHOC_URL_DELIMITER}!=${ADHOC_URL_DELIMITER}404`,
      `path${ADHOC_URL_DELIMITER}=~${ADHOC_URL_DELIMITER}/api/.*`
    ]);
  });
});
