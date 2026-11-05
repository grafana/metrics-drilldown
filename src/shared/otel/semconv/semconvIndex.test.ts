import data from './semconv.generated.json';
import { buildSemconvIndex } from './semconvIndex';
import { type SemconvData } from './types';

const index = buildSemconvIndex(data as unknown as SemconvData);

describe('semconv index against the generated data', () => {
  it('records the pinned versions', () => {
    expect(index.meta).toEqual({
      license: 'Apache-2.0',
      semconvVersion: expect.stringMatching(/^v\d+\.\d+\.\d+$/),
      source: 'https://github.com/open-telemetry/semantic-conventions',
      weaverVersion: expect.stringMatching(/^v\d+\.\d+\.\d+$/),
    });
  });

  // Known Prometheus names and the semconv metric each must resolve to. Update this list when a semconv bump
  // renames or removes one of these metrics.
  const exactNames: Array<[string, string]> = [
    ['http_server_request_duration_seconds', 'http.server.request.duration'],
    ['http_server_request_duration_seconds_bucket', 'http.server.request.duration'],
    ['http_server_request_duration_seconds_sum', 'http.server.request.duration'],
    ['http_server_request_duration_seconds_count', 'http.server.request.duration'],
    ['http_client_request_duration_seconds_bucket', 'http.client.request.duration'],
    ['db_client_operation_duration_seconds_bucket', 'db.client.operation.duration'],
    ['process_cpu_time_seconds_total', 'process.cpu.time'],
    ['jvm_memory_used_bytes', 'jvm.memory.used'],
    ['system_cpu_utilization_ratio', 'system.cpu.utilization'],
    ['dotnet_gc_heap_allocated_bytes_total', 'dotnet.gc.heap.total_allocated'],
    ['hw_network_bandwidth_limit_bytes_per_second', 'hw.network.bandwidth.limit'],
    // Other translation strategies
    ['http_server_request_duration', 'http.server.request.duration'],
    ['http.server.request.duration_seconds', 'http.server.request.duration'],
    ['http.server.request.duration', 'http.server.request.duration'],
  ];

  it.each(exactNames)('matches %s to %s exactly', (prometheusName, otelName) => {
    const match = index.lookupMetric(prometheusName);
    expect(match?.kind).toBe('exact');
    expect(match?.primary.otelName).toBe(otelName);
  });

  it('flags a name that only matches after stripping the type or unit suffix as fuzzy', () => {
    const match = index.lookupMetric('system_cpu_utilization_total');
    expect(match?.kind).toBe('fuzzy');
    expect(match?.primary.otelName).toBe('system.cpu.utilization');
  });

  // Documents why a fuzzy match must never be presented as authoritative: the cAdvisor counter
  // container_cpu_usage_seconds_total reduces to the same base as the semconv gauge container.cpu.usage
  // (measured in CPUs), which is a different metric.
  it('returns only a fuzzy match for the cAdvisor name container_cpu_usage_seconds_total', () => {
    const match = index.lookupMetric('container_cpu_usage_seconds_total');
    expect(match?.kind).toBe('fuzzy');
    expect(match?.primary.otelName).toBe('container.cpu.usage');
  });

  it('does not treat _bucket on a non-histogram name as a histogram series', () => {
    expect(index.lookupMetric('process_cpu_time_seconds_total_bucket')?.kind).not.toBe('exact');
  });

  it('prefers the current metric when a deprecated rename collides with it', () => {
    const match = index.lookupMetric('k8s_container_cpu_limit_utilization_ratio');
    expect(match?.kind).toBe('exact');
    expect(match?.primary.otelName).toBe('k8s.container.cpu.limit.utilization');
    expect(match?.primary.metric.deprecated).toBeUndefined();
    expect(match?.candidates.map((candidate) => candidate.otelName)).toContain('k8s.container.cpu.limit_utilization');
  });

  // Names from non-semconv exporters, and an old semconv name that v1.44.0 no longer defines.
  it.each([
    'go_goroutines',
    'node_cpu_seconds_total',
    'kube_pod_status_phase',
    'http_server_duration_milliseconds_bucket',
    'up',
  ])('does not match %s', (prometheusName) => {
    expect(index.lookupMetric(prometheusName)).toBeUndefined();
  });
});

describe('label and enum lookup', () => {
  it('finds a label by its Prometheus name and by its dotted OTel name', () => {
    expect(index.lookupLabel('http_request_method')?.otelKey).toBe('http.request.method');
    expect(index.lookupLabel('http.request.method')?.otelKey).toBe('http.request.method');
    expect(index.lookupLabel('http_request_method')?.attribute.brief).toBe('HTTP request method.');
  });

  it('prefers the current attribute when a deprecated key collides with it', () => {
    const match = index.lookupLabel('messaging_client_id');
    expect(match?.otelKey).toBe('messaging.client.id');
    expect(match?.attribute.deprecated).toBeUndefined();
  });

  it('returns the deprecation pointer for a deprecated label', () => {
    expect(index.lookupLabel('http_method')?.attribute.deprecated?.renamedTo).toBe('http.request.method');
  });

  it('does not match labels that are not semconv attributes', () => {
    expect(index.lookupLabel('pod')).toBeUndefined();
    expect(index.lookupLabel('instance')).toBeUndefined();
  });

  it('describes an enum value', () => {
    expect(index.lookupEnumValue('http_request_method', 'GET')).toEqual({ brief: 'GET method.', value: 'GET' });
  });

  it('matches an enum value ignoring case', () => {
    expect(index.lookupEnumValue('http_request_method', 'get')?.value).toBe('GET');
  });

  it('matches a numeric enum value given as a string', () => {
    expect(index.lookupEnumValue('rpc_grpc_status_code', '0')?.value).toBe(0);
  });

  it('returns undefined for an unknown value, a non-enum label or an unknown label', () => {
    expect(index.lookupEnumValue('http_request_method', 'NOPE')).toBeUndefined();
    expect(index.lookupEnumValue('service_name', 'checkout')).toBeUndefined();
    expect(index.lookupEnumValue('pod', 'x')).toBeUndefined();
  });
});
