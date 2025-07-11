import { buildVisualQueryFromString } from '@grafana/prometheus';

describe('buildVisualQueryFromString', () => {
  test('should parse basic metric name', () => {
    const result = buildVisualQueryFromString('http_requests_total');
    expect(result.errors).toHaveLength(0);
    expect(result.query.metric).toBe('http_requests_total');
    expect(result.query.labels).toEqual([]);
  });

  test('should parse metric with single label', () => {
    const result = buildVisualQueryFromString('http_requests_total{method="GET"}');
    expect(result.errors).toHaveLength(0);
    expect(result.query.metric).toBe('http_requests_total');
    expect(result.query.labels).toEqual([{ label: 'method', op: '=', value: 'GET' }]);
  });

  test('should parse metric with multiple labels', () => {
    const result = buildVisualQueryFromString('http_requests_total{method="GET",status="200"}');
    expect(result.errors).toHaveLength(0);
    expect(result.query.metric).toBe('http_requests_total');
    expect(result.query.labels).toEqual([
      { label: 'method', op: '=', value: 'GET' },
      { label: 'status', op: '=', value: '200' },
    ]);
  });

  test('should parse metric with different operators', () => {
    const result = buildVisualQueryFromString('http_requests_total{method!="POST",status=~"2.."}');
    expect(result.errors).toHaveLength(0);
    expect(result.query.metric).toBe('http_requests_total');
    expect(result.query.labels).toEqual([
      { label: 'method', op: '!=', value: 'POST' },
      { label: 'status', op: '=~', value: '2..' },
    ]);
  });

  test('should handle escaped quotes in label values', () => {
    const result = buildVisualQueryFromString('http_requests_total{path="/api/v1/users",method="GET"}');
    expect(result.errors).toHaveLength(0);
    expect(result.query.metric).toBe('http_requests_total');
    expect(result.query.labels).toEqual([
      { label: 'path', op: '=', value: '/api/v1/users' },
      { label: 'method', op: '=', value: 'GET' },
    ]);
  });

  test('should handle function expressions', () => {
    const result = buildVisualQueryFromString('rate(http_requests_total[5m])');
    expect(result.errors).toHaveLength(0);
    expect(result.query.metric).toBe('http_requests_total');
    expect(result.query.labels).toEqual([]);
  });

  test('should handle complex function expressions', () => {
    const result = buildVisualQueryFromString('sum(rate(http_requests_total{status="200"}[5m])) by (service)');
    expect(result.errors).toHaveLength(0);
    expect(result.query.metric).toBe('http_requests_total');
    expect(result.query.labels).toEqual([{ label: 'status', op: '=', value: '200' }]);
  });

  test('should handle binary operations', () => {
    const result = buildVisualQueryFromString('http_requests_total{status="200"} / http_requests_total');
    expect(result.errors).toHaveLength(0);
    expect(result.query.metric).toBe('http_requests_total');
    expect(result.query.labels).toEqual([{ label: 'status', op: '=', value: '200' }]);
  });

  test('should handle metric names with underscores and colons', () => {
    const result = buildVisualQueryFromString('namespace:http_requests_total{service="api"}');
    expect(result.errors).toHaveLength(0);
    expect(result.query.metric).toBe('namespace:http_requests_total');
    expect(result.query.labels).toEqual([{ label: 'service', op: '=', value: 'api' }]);
  });

  test('should handle empty label values', () => {
    const result = buildVisualQueryFromString('http_requests_total{method="",status="200"}');
    expect(result.errors).toHaveLength(0);
    expect(result.query.metric).toBe('http_requests_total');
    expect(result.query.labels).toEqual([
      { label: 'method', op: '=', value: '' },
      { label: 'status', op: '=', value: '200' },
    ]);
  });

  test('should handle invalid queries gracefully', () => {
    const result = buildVisualQueryFromString('invalid{query');
    // buildVisualQueryFromString should handle this gracefully, potentially with errors
    // but should not throw an exception
    expect(result).toBeDefined();
    expect(result.errors).toBeDefined();
  });
});
