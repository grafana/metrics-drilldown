import {
  getMetricNameAliases,
  stripHistogramSuffix,
  stripTypeAndUnitSuffix,
  toPrometheusLabelName,
  toPrometheusMetricName,
  type TranslationStrategy,
} from './prometheusNames';
import { type SemconvInstrument } from './types';

describe('toPrometheusMetricName', () => {
  // [otel name, unit, instrument, strategy, expected Prometheus name]
  const cases: Array<[string, string, SemconvInstrument, TranslationStrategy, string]> = [
    // UnderscoreEscapingWithSuffixes (the default)
    [
      'http.server.request.duration',
      's',
      'histogram',
      'UnderscoreEscapingWithSuffixes',
      'http_server_request_duration_seconds',
    ],
    ['process.cpu.time', 's', 'counter', 'UnderscoreEscapingWithSuffixes', 'process_cpu_time_seconds_total'],
    ['jvm.memory.used', 'By', 'updowncounter', 'UnderscoreEscapingWithSuffixes', 'jvm_memory_used_bytes'],
    ['system.cpu.utilization', '1', 'gauge', 'UnderscoreEscapingWithSuffixes', 'system_cpu_utilization_ratio'],
    [
      'hw.network.bandwidth.limit',
      'By/s',
      'updowncounter',
      'UnderscoreEscapingWithSuffixes',
      'hw_network_bandwidth_limit_bytes_per_second',
    ],
    [
      'kestrel.active_connections',
      '{connection}',
      'updowncounter',
      'UnderscoreEscapingWithSuffixes',
      'kestrel_active_connections',
    ],
    ['hw.fan.speed', 'rpm', 'gauge', 'UnderscoreEscapingWithSuffixes', 'hw_fan_speed_rpm'],
    ['go.config.gogc', '%', 'updowncounter', 'UnderscoreEscapingWithSuffixes', 'go_config_gogc_percent'],
    ['container.temperature', 'Cel', 'gauge', 'UnderscoreEscapingWithSuffixes', 'container_temperature_celsius'],
    // A gauge or counter with unit 1: only a gauge gets _ratio, only a counter gets _total.
    ['x.requests', '1', 'counter', 'UnderscoreEscapingWithSuffixes', 'x_requests_total'],
    ['x.queue.size', '1', 'updowncounter', 'UnderscoreEscapingWithSuffixes', 'x_queue_size'],
    // Existing total and ratio tokens are removed and re-appended once at the end.
    [
      'dotnet.gc.heap.total_allocated',
      'By',
      'counter',
      'UnderscoreEscapingWithSuffixes',
      'dotnet_gc_heap_allocated_bytes_total',
    ],
    ['hw.fan.speed_ratio', '1', 'gauge', 'UnderscoreEscapingWithSuffixes', 'hw_fan_speed_ratio'],
    // The unit word is not repeated when it is already a token of the name.
    ['system.memory.bytes', 'By', 'updowncounter', 'UnderscoreEscapingWithSuffixes', 'system_memory_bytes'],
    ['9lives.count', '1', 'updowncounter', 'UnderscoreEscapingWithSuffixes', '_9lives_count'],
    // UnderscoreEscapingWithoutSuffixes
    [
      'http.server.request.duration',
      's',
      'histogram',
      'UnderscoreEscapingWithoutSuffixes',
      'http_server_request_duration',
    ],
    ['process.cpu.time', 's', 'counter', 'UnderscoreEscapingWithoutSuffixes', 'process_cpu_time'],
    // NoUTF8EscapingWithSuffixes keeps the dots
    [
      'http.server.request.duration',
      's',
      'histogram',
      'NoUTF8EscapingWithSuffixes',
      'http.server.request.duration_seconds',
    ],
    ['process.cpu.time', 's', 'counter', 'NoUTF8EscapingWithSuffixes', 'process.cpu.time_seconds_total'],
    ['system.cpu.utilization', '1', 'gauge', 'NoUTF8EscapingWithSuffixes', 'system.cpu.utilization_ratio'],
    [
      'hw.network.bandwidth.limit',
      'By/s',
      'updowncounter',
      'NoUTF8EscapingWithSuffixes',
      'hw.network.bandwidth.limit_bytes_per_second',
    ],
    [
      'dotnet.gc.heap.total_allocated',
      'By',
      'counter',
      'NoUTF8EscapingWithSuffixes',
      'dotnet.gc.heap.total_allocated_bytes_total',
    ],
    ['x.total', '1', 'counter', 'NoUTF8EscapingWithSuffixes', 'x_total'],
    // NoTranslation
    ['http.server.request.duration', 's', 'histogram', 'NoTranslation', 'http.server.request.duration'],
  ];

  it.each(cases)('%s (%s, %s) with %s becomes %s', (name, unit, instrument, strategy, expected) => {
    expect(toPrometheusMetricName(name, unit, instrument, strategy)).toBe(expected);
  });
});

describe('getMetricNameAliases', () => {
  it('returns the name under every translation strategy', () => {
    const aliases = getMetricNameAliases('http.server.request.duration', 's', 'histogram');
    expect(aliases).toHaveLength(4);
    expect(aliases).toEqual(
      expect.arrayContaining([
        'http.server.request.duration',
        'http.server.request.duration_seconds',
        'http_server_request_duration',
        'http_server_request_duration_seconds',
      ])
    );
  });

  it('removes duplicates when strategies agree', () => {
    expect(getMetricNameAliases('foo', '1', 'updowncounter')).toEqual(['foo']);
  });
});

describe('stripHistogramSuffix', () => {
  it.each([
    ['http_server_request_duration_seconds_bucket', 'http_server_request_duration_seconds'],
    ['http_server_request_duration_seconds_count', 'http_server_request_duration_seconds'],
    ['http_server_request_duration_seconds_sum', 'http_server_request_duration_seconds'],
  ])('strips the suffix from %s', (name, expected) => {
    expect(stripHistogramSuffix(name)).toBe(expected);
  });

  it('returns undefined when there is no histogram suffix', () => {
    expect(stripHistogramSuffix('process_cpu_time_seconds_total')).toBeUndefined();
  });
});

describe('stripTypeAndUnitSuffix', () => {
  it.each([
    ['process_cpu_time_seconds_total', 'process_cpu_time'],
    ['system_cpu_utilization_ratio', 'system_cpu_utilization'],
    ['jvm_memory_used_bytes', 'jvm_memory_used'],
    ['hw_network_bandwidth_limit_bytes_per_second', 'hw_network_bandwidth_limit'],
    ['go_goroutine_count', 'go_goroutine_count'],
  ])('reduces %s to %s', (name, expected) => {
    expect(stripTypeAndUnitSuffix(name)).toBe(expected);
  });
});

describe('toPrometheusLabelName', () => {
  it.each([
    ['http.request.method', 'http_request_method'],
    ['k8s.pod.name', 'k8s_pod_name'],
    ['a..b', 'a_b'],
    ['1st.attribute', 'key_1st_attribute'],
    ['already_underscored', 'already_underscored'],
  ])('turns %s into %s', (key, expected) => {
    expect(toPrometheusLabelName(key)).toBe(expected);
  });
});
