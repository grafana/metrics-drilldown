import { classifyMetric, getMetricCategoryLabel, METRIC_CATEGORIES, OTHER_CATEGORY_ID } from '../metricCategories';

describe('classifyMetric', () => {
  test.each([
    // "go" matches Runtime but "google" matches Cloud
    ['go_goroutines', 'runtime'],
    ['go.memory.used', 'runtime'],
    ['jvm_memory_used_bytes', 'runtime'],
    ['google_foo', 'cloud'],
    ['go', OTHER_CATEGORY_ID],
    // HTTP and URL
    ['http_requests_total', 'http'],
    ['http_server_request_duration_seconds', 'http'],
    ['HTTP_requests', 'http'],
    ['url_full', 'url'],
    // The prefix must be the start of the name
    ['prometheus_http_requests_total', OTHER_CATEGORY_ID],
    // Resource-like categories
    ['process_cpu_seconds_total', 'process'],
    ['process.cpu.time', 'process'],
    ['container_cpu_usage_seconds_total', 'container'],
    ['k8s_container_restart_count', 'kubernetes'],
    ['system_x', 'host-os'],
    ['os_x', 'host-os'],
    ['host_x', 'host-os'],
    ['aws_ec2_cpu', 'cloud'],
    ['service_x', 'service'],
    ['deployment_x', 'deployment'],
    ['telemetry_sdk_x', 'telemetry-sdk'],
    // Frontend, including the prefix that contains a dot
    ['device_x', 'frontend'],
    ['session_x', 'frontend'],
    ['browser_x', 'frontend'],
    ['gf_feo11y_x', 'frontend'],
    ['gf.feo11y.x', 'frontend'],
    ['gf_feo11y', OTHER_CATEGORY_ID],
    // Network
    ['net_conntrack_dialer_conn_established_total', 'network'],
    ['server_uptime', 'network'],
    ['client_x', 'network'],
    // Remaining categories
    ['db.client.operation.duration', 'database'],
    ['messaging_x', 'messaging'],
    ['rpc_server_duration', 'rpc'],
    ['error_x', 'error'],
    ['exception_x', 'exception'],
    // Names that match no prefix
    ['node_cpu_seconds_total', OTHER_CATEGORY_ID],
    ['kube_pod_info', OTHER_CATEGORY_ID],
    ['grpc_server_handled_total', OTHER_CATEGORY_ID],
    ['errors_total', OTHER_CATEGORY_ID],
    // ":" is not a separator (e.g. recording rules)
    ['http:requests:rate5m', OTHER_CATEGORY_ID],
  ])('classifies "%s" as "%s"', (metricName, expected) => {
    expect(classifyMetric(metricName)).toBe(expected);
  });
});

describe('METRIC_CATEGORIES', () => {
  test('lists the categories in the display order', () => {
    expect(METRIC_CATEGORIES.map(({ id }) => id)).toEqual([
      'http',
      'url',
      'frontend',
      'service',
      'deployment',
      'database',
      'process',
      'runtime',
      'container',
      'kubernetes',
      'host-os',
      'cloud',
      'telemetry-sdk',
      'error',
      'exception',
      'messaging',
      'network',
      'rpc',
    ]);
  });

  test('has unique ids that do not include "other"', () => {
    const ids = METRIC_CATEGORIES.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(OTHER_CATEGORY_ID);
  });
});

describe('getMetricCategoryLabel', () => {
  test('returns a label for every category and for "other"', () => {
    for (const id of [...METRIC_CATEGORIES.map((category) => category.id), OTHER_CATEGORY_ID]) {
      expect(getMetricCategoryLabel(id)).not.toBe(id);
    }
  });

  test('returns unique labels (counts are matched by label)', () => {
    const labels = [...METRIC_CATEGORIES.map((category) => category.id), OTHER_CATEGORY_ID].map(getMetricCategoryLabel);

    expect(new Set(labels).size).toBe(labels.length);
  });

  test('returns the label of a category id', () => {
    expect(getMetricCategoryLabel('host-os')).toBe('Host / OS');
    expect(getMetricCategoryLabel('runtime')).toBe('Runtime-specific');
    expect(getMetricCategoryLabel(OTHER_CATEGORY_ID)).toBe('Other');
  });

  test('falls back to the id for an unknown category', () => {
    expect(getMetricCategoryLabel('unknown')).toBe('unknown');
  });
});
