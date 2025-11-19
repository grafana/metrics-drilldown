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
    const options = createOptions([
      'grafana_alert_active',
      'grafana_api_response',
      'prometheus_http_requests',
    ]);

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
      engine.applyFilters({ prefixes: ['grafana:alert'], names: ['.*active.*'] }, { forceUpdate: false, notify: false });

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
