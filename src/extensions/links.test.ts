import { parsePromQueryRegex } from './links';

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
