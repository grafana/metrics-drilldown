import { groupByStrategies } from './groupBy';

describe('groupByStrategies', () => {
  // Test basic functionality with simple metrics
  test('correctly groups metrics by suffix', () => {
    const testMetrics = [
      'node_cpu_seconds_total',
      'http_request_bytes',
      'process_status',
      'memory_free',
      'request_failures',
      'connection_requests',
      'cpu_load',
    ];

    const result = groupByStrategies(testMetrics);

    // Check that each metric is in the correct group
    expect(result.suffix['TIME-BASED']).toContain('node_cpu_seconds_total');
    expect(result.suffix['SIZE/RESOURCE']).toContain('http_request_bytes');
    expect(result.suffix['STATE/STATUS']).toContain('process_status');
    expect(result.suffix['RESOURCE USAGE']).toContain('memory_free');
    expect(result.suffix['OPERATION']).toContain('request_failures');
    expect(result.suffix['REQUESTS']).toContain('connection_requests');
    expect(result.suffix['PERFORMANCE']).toContain('cpu_load');
  });

  // Test that metrics with colons are skipped
  test('skips metrics containing colons', () => {
    const testMetrics = [
      'node_cpu_seconds_total',
      ':recording_rule:cpu_usage',
      'http_request_bytes',
      'some:metric:with:colons',
    ];

    const result = groupByStrategies(testMetrics);

    // Check that metrics with colons are not included in any group
    expect(Object.values(result.suffix).flat()).not.toContain(':recording_rule:cpu_usage');
    expect(Object.values(result.suffix).flat()).not.toContain('some:metric:with:colons');

    // Check that other metrics are still included
    expect(Object.values(result.suffix).flat()).toContain('node_cpu_seconds_total');
    expect(Object.values(result.suffix).flat()).toContain('http_request_bytes');
  });

  // Test handling of different delimiters
  test('handles different delimiters correctly', () => {
    const testMetrics = [
      'node_cpu_seconds', // underscore delimiter
      'http.request.bytes', // period delimiter
      'process_status', // underscore delimiter
      'memory.free', // period delimiter
      'nodelimiter', // no delimiter
    ];

    const result = groupByStrategies(testMetrics);

    // Check that each metric is grouped correctly regardless of delimiter
    expect(result.suffix['TIME-BASED']).toContain('node_cpu_seconds');
    expect(result.suffix['SIZE/RESOURCE']).toContain('http.request.bytes');
    expect(result.suffix['STATE/STATUS']).toContain('process_status');
    expect(result.suffix['RESOURCE USAGE']).toContain('memory.free');

    // No delimiter should be in OTHER
    expect(result.suffix['OTHER']).toContain('nodelimiter');
  });

  // Test special case handling for total, bucket, summary, count
  test('uses second-to-last element when suffix is total, bucket, summary, or count', () => {
    const testMetrics = [
      'node_cpu_seconds_total', // should use "seconds" as the suffix
      'http_latency_bucket', // should use "latency" as the suffix
      'memory_usage_summary', // should use "usage" as the suffix
      'request_errors_count', // should use "errors" as the suffix
      'normal_metric_name', // should use "name" as the suffix
    ];

    const result = groupByStrategies(testMetrics);

    // Check that special suffixes are handled correctly
    expect(result.suffix['TIME-BASED']).toContain('node_cpu_seconds_total');
    expect(result.suffix['OTHER']).toContain('http_latency_bucket'); // latency isn't in our groups
    expect(result.suffix['RESOURCE USAGE']).toContain('memory_usage_summary');
    expect(result.suffix['OPERATION']).toContain('request_errors_count');
    expect(result.suffix['OTHER']).toContain('normal_metric_name'); // name isn't in our groups
  });

  // Test that unrecognized suffixes go to OTHER
  test('places metrics with unrecognized suffixes in OTHER', () => {
    const testMetrics = ['cpu_value', 'memory_percent', 'disk_ratio', 'network_throughput'];

    const result = groupByStrategies(testMetrics);

    // All of these have suffixes not in our groups, so they should be in OTHER
    expect(result.suffix['OTHER']).toContain('cpu_value');
    expect(result.suffix['OTHER']).toContain('memory_percent');
    expect(result.suffix['OTHER']).toContain('disk_ratio');
    expect(result.suffix['OTHER']).toContain('network_throughput');
  });

  // Test that all groups are initialized, even if no metrics match them
  test('initializes all groups even if empty', () => {
    const testMetrics = [
      'cpu_value', // will go to OTHER
    ];

    const result = groupByStrategies(testMetrics);

    // Check that all groups exist
    expect(result.suffix['TIME-BASED']).toEqual([]);
    expect(result.suffix['SIZE/RESOURCE']).toEqual([]);
    expect(result.suffix['STATE/STATUS']).toEqual([]);
    expect(result.suffix['RESOURCE USAGE']).toEqual([]);
    expect(result.suffix['OPERATION']).toEqual([]);
    expect(result.suffix['REQUESTS']).toEqual([]);
    expect(result.suffix['PERFORMANCE']).toEqual([]);
    expect(result.suffix['OTHER']).toContain('cpu_value');
  });
});
