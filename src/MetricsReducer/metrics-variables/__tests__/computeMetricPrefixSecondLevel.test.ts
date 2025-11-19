import { computeMetricPrefixSecondLevel, HIERARCHICAL_SEPARATOR } from '../computeMetricPrefixSecondLevel';

const createOptions = (values: string[]) => values.map((value) => ({ label: value, value }));

describe('computeMetricPrefixSecondLevel()', () => {
  test('computes second-level substrings for a given prefix', () => {
    const options = createOptions(['grafana_alert_active', 'grafana_alert_pending', 'grafana_node_cpu']);

    const result = computeMetricPrefixSecondLevel(options, 'grafana');

    expect(result).toEqual([
      { label: 'alert', value: `grafana${HIERARCHICAL_SEPARATOR}alert`, count: 2 },
      { label: 'node', value: `grafana${HIERARCHICAL_SEPARATOR}node`, count: 1 },
    ]);
  });

  test('sorts by count descending, then alphabetically', () => {
    const options = createOptions([
      'prom_alpha_metric',
      'prom_beta_one',
      'prom_beta_two',
      'prom_beta_three',
      'prom_charlie_metric',
    ]);

    const result = computeMetricPrefixSecondLevel(options, 'prom');

    expect(result).toEqual([
      { label: 'beta', value: `prom${HIERARCHICAL_SEPARATOR}beta`, count: 3 },
      { label: 'alpha', value: `prom${HIERARCHICAL_SEPARATOR}alpha`, count: 1 },
      { label: 'charlie', value: `prom${HIERARCHICAL_SEPARATOR}charlie`, count: 1 },
    ]);
  });

  test('returns empty array when no matching metrics', () => {
    const options = createOptions(['grafana_alert_active', 'prometheus_requests']);

    const result = computeMetricPrefixSecondLevel(options, 'nonexistent');

    expect(result).toEqual([]);
  });

  test('returns empty array when prefix has no second level', () => {
    const options = createOptions(['singlename', 'grafana_alert']);

    const result = computeMetricPrefixSecondLevel(options, 'singlename');

    expect(result).toEqual([]);
  });

  test('handles empty options array', () => {
    const result = computeMetricPrefixSecondLevel([], 'grafana');

    expect(result).toEqual([]);
  });

  describe('separator handling', () => {
    test.each([
      ['underscore', 'node_cpu_usage', 'node', 'cpu'],
      ['hyphen', 'api-request-count', 'api', 'request'],
      ['colon', 'service:request:total', 'service', 'request'],
      ['period', 'app.request.sum', 'app', 'request'],
    ])('handles %s separator', (_name, metric, parent, expectedChild) => {
      const options = createOptions([metric]);

      const result = computeMetricPrefixSecondLevel(options, parent);

      expect(result).toEqual([{ label: expectedChild, value: `${parent}${HIERARCHICAL_SEPARATOR}${expectedChild}`, count: 1 }]);
    });

    test('treats any non-alphanumeric character as separator', () => {
      const options = createOptions(['test@metric', 'test#other', 'test$value']);

      const result = computeMetricPrefixSecondLevel(options, 'test');

      expect(result.map((r) => r.label)).toEqual(['metric', 'other', 'value']);
    });
  });

  describe('prefix matching', () => {
    test('only matches exact prefix at start of metric name', () => {
      const options = createOptions(['grafana_alert', 'mygrafana_alert', 'grafanatest_alert']);

      const result = computeMetricPrefixSecondLevel(options, 'grafana');

      expect(result).toEqual([{ label: 'alert', value: `grafana${HIERARCHICAL_SEPARATOR}alert`, count: 1 }]);
    });

    test('prefix matching is case-sensitive', () => {
      const options = createOptions(['HTTP_requests', 'http_requests']);

      const result = computeMetricPrefixSecondLevel(options, 'http');

      expect(result).toEqual([{ label: 'requests', value: `http${HIERARCHICAL_SEPARATOR}requests`, count: 1 }]);
    });
  });

  describe('real-world examples', () => {
    test('handles Prometheus node_exporter metrics', () => {
      const options = createOptions([
        'node_cpu_seconds_total',
        'node_cpu_guest_seconds_total',
        'node_memory_MemTotal_bytes',
        'node_memory_MemFree_bytes',
        'node_disk_io_time_seconds_total',
      ]);

      const result = computeMetricPrefixSecondLevel(options, 'node');

      expect(result).toEqual([
        { label: 'cpu', value: `node${HIERARCHICAL_SEPARATOR}cpu`, count: 2 },
        { label: 'memory', value: `node${HIERARCHICAL_SEPARATOR}memory`, count: 2 },
        { label: 'disk', value: `node${HIERARCHICAL_SEPARATOR}disk`, count: 1 },
      ]);
    });

    test('handles Grafana application metrics', () => {
      const options = createOptions([
        'grafana_alerting_active_alerts',
        'grafana_alerting_pending_alerts',
        'grafana_api_response_status_total',
        'grafana_database_conn_open',
      ]);

      const result = computeMetricPrefixSecondLevel(options, 'grafana');

      expect(result).toEqual([
        { label: 'alerting', value: `grafana${HIERARCHICAL_SEPARATOR}alerting`, count: 2 },
        { label: 'api', value: `grafana${HIERARCHICAL_SEPARATOR}api`, count: 1 },
        { label: 'database', value: `grafana${HIERARCHICAL_SEPARATOR}database`, count: 1 },
      ]);
    });
  });
});
