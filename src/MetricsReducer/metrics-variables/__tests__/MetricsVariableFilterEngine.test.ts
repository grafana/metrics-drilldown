import { MetricsVariableFilterEngine } from '../MetricsVariableFilterEngine';

import type { QueryVariable } from '@grafana/scenes';

const createOptions = (values: string[]) => values.map((value) => ({ label: value, value }));

function setup() {
  const setState = jest.fn();
  const publishEvent = jest.fn();
  const mockVariable = { setState, publishEvent } as unknown as QueryVariable;
  const engine = new MetricsVariableFilterEngine(mockVariable);

  return { engine, setState, publishEvent };
}

describe('MetricsVariableFilterEngine - hierarchical prefix filtering', () => {
  test('filters metrics by hierarchical prefix (parent:child)', () => {
    const { engine, setState } = setup();
    const options = createOptions([
      'grafana_alert_active',
      'grafana_alert_pending',
      'grafana_node_cpu',
      'prometheus_http_requests',
    ]);

    engine.setInitOptions(options);
    engine.applyFilters({ prefixes: ['grafana:alert'] }, { forceUpdate: false, notify: false });

    expect(setState).toHaveBeenCalledWith({
      options: [
        { label: 'grafana_alert_active', value: 'grafana_alert_active' },
        { label: 'grafana_alert_pending', value: 'grafana_alert_pending' },
      ],
    });
  });

  test('handles multiple hierarchical prefix filters', () => {
    const { engine, setState } = setup();
    const options = createOptions([
      'grafana_alert_active',
      'grafana_api_response',
      'node_cpu_usage',
      'node_memory_total',
    ]);

    engine.setInitOptions(options);
    engine.applyFilters({ prefixes: ['grafana:alert', 'node:memory'] }, { forceUpdate: false, notify: false });

    expect(setState).toHaveBeenCalledWith({
      options: [
        { label: 'grafana_alert_active', value: 'grafana_alert_active' },
        { label: 'node_memory_total', value: 'node_memory_total' },
      ],
    });
  });

  test('filters by single-level prefix (backward compatibility)', () => {
    const { engine, setState } = setup();
    const options = createOptions(['grafana_alert_active', 'grafana_node_cpu', 'prometheus_http_requests']);

    engine.setInitOptions(options);
    engine.applyFilters({ prefixes: ['grafana'] }, { forceUpdate: false, notify: false });

    expect(setState).toHaveBeenCalledWith({
      options: [
        { label: 'grafana_alert_active', value: 'grafana_alert_active' },
        { label: 'grafana_node_cpu', value: 'grafana_node_cpu' },
      ],
    });
  });

  test('handles mixed single-level and hierarchical prefixes', () => {
    const { engine, setState } = setup();
    const options = createOptions(['grafana_alert_active', 'grafana_api_response', 'prometheus_http_requests']);

    engine.setInitOptions(options);
    engine.applyFilters({ prefixes: ['grafana:alert', 'prometheus'] }, { forceUpdate: false, notify: false });

    expect(setState).toHaveBeenCalledWith({
      options: [
        { label: 'grafana_alert_active', value: 'grafana_alert_active' },
        { label: 'prometheus_http_requests', value: 'prometheus_http_requests' },
      ],
    });
  });

  describe('separator handling', () => {
    test.each([
      ['underscore', 'app_request_total'],
      ['hyphen', 'app-request-total'],
      ['colon', 'app:request:total'],
      ['period', 'app.request.total'],
    ])('matches metrics with %s separator', (_name, metric) => {
      const { engine, setState } = setup();
      const options = createOptions([metric]);

      engine.setInitOptions(options);
      engine.applyFilters({ prefixes: ['app:request'] }, { forceUpdate: false, notify: false });

      expect(setState).toHaveBeenCalledWith({ options: [{ label: metric, value: metric }] });
    });
  });

  describe('edge cases', () => {
    test('returns empty array when no metrics match', () => {
      const { engine, setState } = setup();
      const options = createOptions(['grafana_alert_active', 'prometheus_http_requests']);

      engine.setInitOptions(options);
      engine.applyFilters({ prefixes: ['nonexistent:filter'] }, { forceUpdate: false, notify: false });

      expect(setState).toHaveBeenCalledWith({ options: [] });
    });

    test('does not match partial prefix names', () => {
      const { engine, setState } = setup();
      const options = createOptions(['grafana_alert_active', 'grafana_other_metric', 'grafana_alerting_rules']);

      engine.setInitOptions(options);
      engine.applyFilters({ prefixes: ['grafana:alert'] }, { forceUpdate: false, notify: false });

      expect(setState).toHaveBeenCalledWith({
        options: [{ label: 'grafana_alert_active', value: 'grafana_alert_active' }],
      });
    });

    test('requires separator after both parent and child', () => {
      const { engine, setState } = setup();
      const options = createOptions(['grafana_alert_active', 'grafanaalert_other', 'grafana_alertother']);

      engine.setInitOptions(options);
      engine.applyFilters({ prefixes: ['grafana:alert'] }, { forceUpdate: false, notify: false });

      expect(setState).toHaveBeenCalledWith({
        options: [{ label: 'grafana_alert_active', value: 'grafana_alert_active' }],
      });
    });
  });

  describe('integration with other filters', () => {
    test('combines hierarchical prefix with suffix filter', () => {
      const { engine, setState } = setup();
      const options = createOptions(['grafana_alert_total', 'grafana_alert_count', 'grafana_api_total']);

      engine.setInitOptions(options);
      engine.applyFilters({ prefixes: ['grafana:alert'], suffixes: ['total'] }, { forceUpdate: false, notify: false });

      expect(setState).toHaveBeenCalledWith({
        options: [{ label: 'grafana_alert_total', value: 'grafana_alert_total' }],
      });
    });

    test('combines hierarchical prefix with name filter', () => {
      const { engine, setState } = setup();
      const options = createOptions(['grafana_alert_active', 'grafana_alert_pending', 'grafana_alert_firing']);

      engine.setInitOptions(options);
      engine.applyFilters(
        { prefixes: ['grafana:alert'], names: ['.*active.*'] },
        { forceUpdate: false, notify: false }
      );

      expect(setState).toHaveBeenCalledWith({
        options: [{ label: 'grafana_alert_active', value: 'grafana_alert_active' }],
      });
    });
  });

  test('returns all options when filter is cleared', () => {
    const { engine, setState } = setup();
    const options = createOptions(['grafana_alert_active', 'prometheus_http_requests', 'node_cpu_usage']);

    engine.setInitOptions(options);
    engine.applyFilters({ prefixes: ['grafana:alert'] }, { forceUpdate: false, notify: false });
    engine.applyFilters({ prefixes: [] }, { forceUpdate: false, notify: false });

    expect(setState).toHaveBeenLastCalledWith({ options });
  });
});

describe('MetricsVariableFilterEngine - firingAlertMetrics filtering', () => {
  test('filters options to only those present in firingAlertMetrics set', () => {
    const { engine, setState } = setup();
    const options = createOptions(['http_requests_total', 'cpu_usage', 'memory_bytes']);

    engine.setInitOptions(options);
    engine.applyFilters(
      { firingAlertMetrics: ['http_requests_total', 'cpu_usage'] },
      { forceUpdate: false, notify: false }
    );

    expect(setState).toHaveBeenCalledWith({
      options: [
        { label: 'http_requests_total', value: 'http_requests_total' },
        { label: 'cpu_usage', value: 'cpu_usage' },
      ],
    });
  });

  test('empty firingAlertMetrics array passes all options through (filter inactive)', () => {
    const { engine, setState } = setup();
    const options = createOptions(['http_requests_total', 'cpu_usage', 'memory_bytes']);

    engine.setInitOptions(options);
    // forceUpdate: true so the reset path runs even though the engine starts with empty filters
    engine.applyFilters({ firingAlertMetrics: [] }, { forceUpdate: true, notify: false });

    // All filters empty → reset to init options
    expect(setState).toHaveBeenCalledWith({ options });
  });

  test('silently ignores firingAlertMetrics names not present in options', () => {
    const { engine, setState } = setup();
    const options = createOptions(['http_requests_total', 'cpu_usage']);

    engine.setInitOptions(options);
    engine.applyFilters(
      { firingAlertMetrics: ['http_requests_total', 'nonexistent_metric'] },
      { forceUpdate: false, notify: false }
    );

    expect(setState).toHaveBeenCalledWith({
      options: [{ label: 'http_requests_total', value: 'http_requests_total' }],
    });
  });

  test('clearing firingAlertMetrics back to [] restores all options', () => {
    const { engine, setState } = setup();
    const options = createOptions(['http_requests_total', 'cpu_usage', 'memory_bytes']);

    engine.setInitOptions(options);
    engine.applyFilters({ firingAlertMetrics: ['http_requests_total'] }, { forceUpdate: false, notify: false });
    engine.applyFilters({ firingAlertMetrics: [] }, { forceUpdate: false, notify: false });

    expect(setState).toHaveBeenLastCalledWith({ options });
  });

  test('composes with prefixes filter — returns intersection', () => {
    const { engine, setState } = setup();
    const options = createOptions([
      'http_requests_total',
      'http_errors_total',
      'cpu_usage',
    ]);

    engine.setInitOptions(options);
    engine.applyFilters(
      { prefixes: ['http'], firingAlertMetrics: ['http_requests_total', 'cpu_usage'] },
      { forceUpdate: false, notify: false }
    );

    // http prefix matches http_requests_total + http_errors_total; then firingAlerts keeps only http_requests_total
    expect(setState).toHaveBeenCalledWith({
      options: [{ label: 'http_requests_total', value: 'http_requests_total' }],
    });
  });

  test('composes with names filter — returns intersection', () => {
    const { engine, setState } = setup();
    const options = createOptions(['http_requests_total', 'http_errors_total', 'cpu_usage']);

    engine.setInitOptions(options);
    engine.applyFilters(
      { names: ['http.*'], firingAlertMetrics: ['http_requests_total', 'cpu_usage'] },
      { forceUpdate: false, notify: false }
    );

    // names filter keeps http_requests_total + http_errors_total; firingAlerts keeps only http_requests_total
    expect(setState).toHaveBeenCalledWith({
      options: [{ label: 'http_requests_total', value: 'http_requests_total' }],
    });
  });

  test('all filter dimensions empty resets to init options', () => {
    const { engine, setState } = setup();
    const options = createOptions(['http_requests_total', 'cpu_usage']);

    engine.setInitOptions(options);
    // forceUpdate: true so the reset path runs even though the engine starts with empty filters
    engine.applyFilters(
      { categories: [], prefixes: [], suffixes: [], names: [], firingAlertMetrics: [] },
      { forceUpdate: true, notify: false }
    );

    expect(setState).toHaveBeenCalledWith({ options });
  });
});
