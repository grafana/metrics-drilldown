import { parsePromQLQuery } from './links';

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
