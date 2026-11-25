import { DataFrameType, LoadingState, type ScopedVars } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/plugin-compat/datasources';
import { PrometheusDatasource, type PromQuery } from '@grafana/prometheus';
import { sceneGraph, SceneQueryRunner } from '@grafana/scenes';
import { waitFor } from '@testing-library/react';

import { getPreferredConfigForMetric } from 'shared/GmdVizPanel/config/getPreferredConfigForMetric';
import { removeIgnoreUsageLabel } from 'shared/utils/utils.queries';
import { createMockDataSource } from 'test/mocks/datasource';

import {
  createMetricScene,
  isValidMetricSceneOptions,
  observeMetricQueries,
  type MetricSceneOptions,
} from './metricScene';

jest.mock('@grafana/plugin-compat/datasources', () => ({ getDataSourceInstance: jest.fn() }));
jest.mock('shared/GmdVizPanel/config/getPreferredConfigForMetric', () => ({ getPreferredConfigForMetric: jest.fn() }));

const scope: MetricSceneOptions = {
  dataSourceUid: 'prom-a',
  metric: 'temperature',
  from: 1700000000000,
  to: 1700003600000,
};

function mockMetadata(type: string) {
  jest.mocked(getDataSourceInstance).mockImplementation(async (_ref, scopedVars) => {
    const scene = scopedVars?.__sceneObject?.value;
    const uid = sceneGraph.interpolate(scene, '${ds}');
    return {
      type: 'prometheus',
      uid,
      languageProvider: { request: jest.fn(async () => ({ [scope.metric]: [{ type }] })) },
    } as any;
  });
}

function activate(options = scope) {
  const model = createMetricScene(options);
  const deactivateScene = model.scene.activate();
  // Don't activate VizPanel: panel plugins require a running Grafana. The real model builds its real runner.
  const deactivatePanel = model.panel.activate();
  return {
    ...model,
    stop: () => {
      deactivatePanel();
      deactivateScene();
    },
  };
}

beforeEach(() => {
  mockMetadata('gauge');
  jest.spyOn(SceneQueryRunner.prototype, 'runQueries').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('createMetricScene', () => {
  test.each([
    ['gauge', 'timeseries', 'avg(temperature{__ignore_usage__="", })'],
    ['counter', 'timeseries', 'sum(rate(temperature{__ignore_usage__="", }[$__rate_interval]))'],
    ['histogram', 'heatmap', 'sum by (le) (rate(temperature{__ignore_usage__="", }[$__rate_interval]))'],
  ])('resolves %s metadata without a DataTrail and preserves defaults', async (type, pluginId, expression) => {
    mockMetadata(type);
    const model = activate();
    const callback = jest.fn();
    const unsubscribe = observeMetricQueries(model.panel, callback);
    try {
      await waitFor(() => expect(model.panel.state.metricTypeResolved).toBe(true));
      expect(model.panel.state.body?.state.pluginId).toBe(pluginId);
      expect(callback).toHaveBeenLastCalledWith([
        expect.objectContaining({
          expr: removeIgnoreUsageLabel(expression),
          datasource: { uid: 'prom-a' },
        }),
      ]);
      const runner = sceneGraph.findDescendents(model.panel.state.body!, SceneQueryRunner)[0];
      expect(sceneGraph.interpolate(runner, runner.state.queries[0].expr as string)).toBe(expression);
      expect(callback.mock.lastCall[0][0].expr).not.toContain('__ignore_usage__');
      expect(getPreferredConfigForMetric).not.toHaveBeenCalled();
      expect(model.panel.state.body?.state.headerActions).toEqual([]);
      expect(model.panel.state.body?.state.menu).toBeUndefined();
    } finally {
      unsubscribe();
      model.stop();
    }
  });

  test.each([
    ['traffic_bytes', 'counter', 'bytes', 'Bps'],
    ['traffic_bytes_total', 'gauge', 'Bps', 'bytes'],
  ])(
    'corrects %s timeseries units from %s metadata without losing field configuration',
    async (metric, type, initialUnit, resolvedUnit) => {
      jest.mocked(getDataSourceInstance).mockResolvedValue({
        uid: scope.dataSourceUid,
        type: 'prometheus',
        languageProvider: { request: async () => ({ [metric]: [{ type }] }) },
      } as any);
      const model = activate({ ...scope, metric });
      try {
        const body = model.panel.state.body!;
        expect(body.state.fieldConfig.defaults.unit).toBe(initialUnit);
        body.setState({
          fieldConfig: {
            ...body.state.fieldConfig,
            defaults: { ...body.state.fieldConfig.defaults, min: 0, decimals: 3 },
            overrides: [{ matcher: { id: 'byName', options: 'traffic' }, properties: [{ id: 'max', value: 100 }] }],
          },
        });
        const originalConfig = body.state.fieldConfig;
        await waitFor(() => expect(model.panel.state.metricTypeResolved).toBe(true));
        expect(model.panel.state.metricType).toBe(type);
        expect(body.state.fieldConfig).toEqual({
          ...originalConfig,
          defaults: { ...originalConfig.defaults, unit: resolvedUnit },
        });
      } finally {
        model.stop();
      }
    }
  );

  test('keeps classic histogram defaults, expands explicit filters, and applies the rate override', async () => {
    const model = activate({
      ...scope,
      metric: 'request_duration_bucket',
      customRateInterval: '5m',
      filters: [{ key: 'job', operator: '=', value: 'api"one' }],
    });
    const callback = jest.fn();
    const unsubscribe = observeMetricQueries(model.panel, callback);
    try {
      await waitFor(() => expect(callback).toHaveBeenCalled());
      expect(model.panel.state.metricType).toBe('classic-histogram');
      expect(callback.mock.lastCall[0][0].expr).toBe(
        'sum by (le) (rate(request_duration_bucket{ job="api\\"one"}[5m]))'
      );
    } finally {
      unsubscribe();
      model.stop();
    }
  });

  test('keeps dollar/template-looking filter values literal instead of expanding scene variables', async () => {
    const model = activate({ ...scope, filters: [{ key: 'job', operator: '=', value: '${ds}-$__rate_interval' }] });
    const callback = jest.fn();
    const unsubscribe = observeMetricQueries(model.panel, callback);
    try {
      await waitFor(() => expect(callback).toHaveBeenCalled());
      expect(callback.mock.lastCall[0][0].expr).toBe('avg(temperature{ job="\\u0024{ds}-\\u0024__rate_interval"})');
    } finally {
      unsubscribe();
      model.stop();
    }
  });

  test.each([
    ['${ds}-$__rate_interval', '\\u0024{ds}-\\u0024__rate_interval'],
    ['[[ds]]', '\\u005b\\u005bds]]'],
    ['[a-z]+$', '\\u005ba-z]+\\u0024'],
  ])('literal %j survives real Prometheus template passes and rate macro expansion', async (literal, escaped) => {
    mockMetadata('counter');
    const model = activate({ ...scope, filters: [{ key: 'job', operator: '=', value: literal }] });
    try {
      await waitFor(() => expect(model.panel.state.metricTypeResolved).toBe(true));
      const runner = sceneGraph.findDescendents(model.panel.state.body!, SceneQueryRunner)[0];
      const replace = jest.fn((text?: string, vars?: ScopedVars, format?: string | Function) =>
        sceneGraph.interpolate(model.panel, text, vars, format as Parameters<typeof sceneGraph.interpolate>[3])
      );
      // Grafana's template service delegates scene-scoped values to the scene interpolator. Run
      // the real datasource method so its second template pass is part of this regression.
      const datasource = new PrometheusDatasource(createMockDataSource({ uid: scope.dataSourceUid }), {
        replace,
        getVariables: () => [],
        containsTemplate: () => false,
        updateTimeRange: () => {},
      });
      const target = runner.state.queries[0] as PromQuery;
      const applied = datasource.applyTemplateVariables(target, {});
      expect(replace.mock.calls[0][0]).toContain('${filters:raw}');
      expect(replace.mock.calls[1][0]).toContain(`job="${escaped}"`);
      expect(applied.expr).toBe(`sum(rate(temperature{__ignore_usage__="", job="${escaped}"}[$__rate_interval]))`);
      expect(applied.expr.match(/\$__rate_interval/g)).toHaveLength(1);
      // Backend macro substitution sees only the real rate macro, not dollars inside label values.
      const backendExpression = applied.expr.replaceAll('$__rate_interval', '1m');
      expect(backendExpression).toContain('[1m]');
      const encodedValue = backendExpression.match(/job=("(?:[^"\\]|\\.)*")/)?.[1];
      expect(JSON.parse(encodedValue!)).toBe(literal);
    } finally {
      model.stop();
    }
  });

  test.each([
    ['', 'job=""'],
    ['""', 'job="\\"\\""'],
  ])('preserves explicit filter value %j without legacy empty sentinels', async (value, matcher) => {
    const model = activate({ ...scope, filters: [{ key: 'job', operator: '=', value }] });
    const callback = jest.fn();
    const unsubscribe = observeMetricQueries(model.panel, callback);
    try {
      await waitFor(() => expect(callback).toHaveBeenCalled());
      expect(callback.mock.lastCall[0][0].expr).toContain(matcher);
    } finally {
      unsubscribe();
      model.stop();
    }
  });

  test('two instances keep datasource, filters, time and metadata isolated', async () => {
    jest.mocked(getDataSourceInstance).mockImplementation(async (_ref, scopedVars) => {
      const uid = sceneGraph.interpolate(scopedVars?.__sceneObject?.value, '${ds}');
      return {
        type: 'prometheus',
        uid,
        languageProvider: {
          request: async () => ({ temperature: [{ type: uid === 'prom-a' ? 'counter' : 'histogram' }] }),
        },
      } as any;
    });
    const a = activate({ ...scope, filters: [{ key: 'job', operator: '=', value: 'a' }] });
    const b = activate({
      ...scope,
      dataSourceUid: 'prom-b',
      from: 1800000000000,
      to: 1800003600000,
      filters: [{ key: 'job', operator: '=', value: 'b' }],
    });
    const onA = jest.fn();
    const onB = jest.fn();
    const offA = observeMetricQueries(a.panel, onA);
    const offB = observeMetricQueries(b.panel, onB);
    try {
      await waitFor(() => {
        expect(onA).toHaveBeenCalled();
        expect(onB).toHaveBeenCalled();
      });
      expect(a.panel.state.metricType).toBe('counter');
      expect(b.panel.state.metricType).toBe('native-histogram');
      expect(onA.mock.lastCall[0][0]).toMatchObject({ datasource: { uid: 'prom-a' } });
      expect(onA.mock.lastCall[0][0].expr).toContain('job="a"');
      expect(onB.mock.lastCall[0][0]).toMatchObject({ datasource: { uid: 'prom-b' } });
      expect(onB.mock.lastCall[0][0].expr).toContain('job="b"');
      expect(a.scene.state.$timeRange?.state.value.from.valueOf()).toBe(scope.from);
      expect(b.scene.state.$timeRange?.state.value.from.valueOf()).toBe(1800000000000);
    } finally {
      offA();
      offB();
      a.stop();
      b.stop();
    }
  });

  test('tracks current runner queries, rebinds on panel rebuild, and stops on cleanup', async () => {
    const model = activate();
    const callback = jest.fn();
    const unsubscribe = observeMetricQueries(model.panel, callback);
    try {
      await waitFor(() => expect(callback).toHaveBeenCalled());
      const oldRunner = sceneGraph.findDescendents(model.panel.state.body!, SceneQueryRunner)[0];
      oldRunner.setState({ queries: [{ refId: 'fallback', expr: 'max(temperature{${filters:raw}})' }] });
      expect(callback.mock.lastCall[0][0].expr).toBe('max(temperature{})');
      model.panel.update({ type: 'heatmap' }, {});
      const count = callback.mock.calls.length;
      oldRunner.setState({ queries: [{ refId: 'stale', expr: 'stale' }] });
      expect(callback).toHaveBeenCalledTimes(count);
      unsubscribe();
      const runner = sceneGraph.findDescendents(model.panel.state.body!, SceneQueryRunner)[0];
      runner.setState({ queries: [{ refId: 'unmounted', expr: 'unmounted' }] });
      expect(callback).toHaveBeenCalledTimes(count);
    } finally {
      unsubscribe();
      model.stop();
    }
  });

  test('failed metadata and a failed native-histogram probe leave the existing query/error path intact', async () => {
    jest.mocked(getDataSourceInstance).mockRejectedValue(new Error('Datasource unavailable'));
    const model = activate();
    const callback = jest.fn();
    const unsubscribe = observeMetricQueries(model.panel, callback);
    try {
      await waitFor(() => expect(model.panel.state.$data).toBeInstanceOf(SceneQueryRunner));
      const probe = model.panel.state.$data as SceneQueryRunner;
      probe.setState({
        data: { state: LoadingState.Error, series: [], timeRange: sceneGraph.getTimeRange(model.panel).state.value },
      });
      expect(model.panel.state.metricTypeResolved).toBe(true);
      expect(model.panel.state.metricType).toBe('gauge');
      expect(model.panel.state.$data).toBeUndefined();
      expect(callback.mock.lastCall[0][0].expr).toContain('avg(temperature');
    } finally {
      unsubscribe();
      model.stop();
    }
  });

  test('missing metadata can resolve a native histogram through the existing rated probe without a DataTrail', async () => {
    jest
      .mocked(getDataSourceInstance)
      .mockResolvedValue({ uid: 'prom-a', type: 'prometheus', languageProvider: { request: async () => ({}) } } as any);
    const model = activate({ ...scope, customRateInterval: '10m' });
    const callback = jest.fn();
    const unsubscribe = observeMetricQueries(model.panel, callback);
    try {
      await waitFor(() => expect(model.panel.state.$data).toBeInstanceOf(SceneQueryRunner));
      const probe = model.panel.state.$data as SceneQueryRunner;
      expect(probe.state.queries[0].expr).toContain('[10m]');
      expect(callback).not.toHaveBeenCalled();
      probe.setState({
        data: {
          state: LoadingState.Done,
          series: [{ length: 1, fields: [], meta: { type: DataFrameType.HeatmapCells } }],
          timeRange: sceneGraph.getTimeRange(model.panel).state.value,
        },
      });
      expect(model.panel.state.metricType).toBe('native-histogram');
      expect(callback.mock.lastCall[0][0].expr).toBe('sum by (le) (rate(temperature{ }[10m]))');
    } finally {
      unsubscribe();
      model.stop();
    }
  });

  test.each([
    ['gauge', 'temperature', 'avg by (job) (temperature{__ignore_usage__="", })'],
    ['counter', 'temperature', 'sum by (job) (rate(temperature{__ignore_usage__="", }[5m]))'],
    ['histogram', 'temperature', 'histogram_sum(sum by (job) (rate(temperature{__ignore_usage__="", }[5m])))'],
    ['histogram', 'duration_bucket', 'sum by (job) (rate(duration_sum{__ignore_usage__="", }[5m]))'],
  ])('pins grouped %s %s to timeseries without forking query defaults', async (type, metric, expr) => {
    mockMetadata(type);
    const model = createMetricScene(
      { ...scope, metric, customRateInterval: '5m' },
      { groupBy: 'job' },
      { type: 'timeseries' }
    );
    const offScene = model.scene.activate();
    const offPanel = model.panel.activate();
    const callback = jest.fn();
    const off = observeMetricQueries(model.panel, callback);
    try {
      await waitFor(() => expect(callback).toHaveBeenCalled());
      expect(model.panel.state.body?.state.pluginId).toBe('timeseries');
      expect(callback.mock.lastCall[0]).toHaveLength(1);
      expect(callback.mock.lastCall[0][0].expr).toBe(removeIgnoreUsageLabel(expr));
      expect(sceneGraph.findDescendents(model.panel.state.body!, SceneQueryRunner)).toHaveLength(1);
    } finally {
      off();
      offPanel();
      offScene();
    }
  });

  test.each([
    ['counter', 'temperature', 'sum by (job) (rate(temperature{__ignore_usage__="", }[$__rate_interval]))'],
    [
      'histogram',
      'temperature',
      'histogram_sum(sum by (job) (rate(temperature{__ignore_usage__="", }[$__rate_interval])))',
    ],
    ['histogram', 'duration_bucket', 'sum by (job) (rate(duration_sum{__ignore_usage__="", }[$__rate_interval]))'],
  ])('keeps the built-in rate interval for grouped %s %s', async (type, metric, expr) => {
    mockMetadata(type);
    const model = createMetricScene({ ...scope, metric }, { groupBy: 'job' }, { type: 'timeseries' });
    const offScene = model.scene.activate();
    const offPanel = model.panel.activate();
    const callback = jest.fn();
    const off = observeMetricQueries(model.panel, callback);
    try {
      await waitFor(() => expect(callback).toHaveBeenCalled());
      expect(callback.mock.lastCall[0][0].expr).toBe(removeIgnoreUsageLabel(expr));
    } finally {
      off();
      offPanel();
      offScene();
    }
  });

  test('supports the same setup for a later chosen-label breakdown', async () => {
    const model = createMetricScene(scope, { groupBy: 'job' });
    const offScene = model.scene.activate();
    const offPanel = model.panel.activate();
    const callback = jest.fn();
    const off = observeMetricQueries(model.panel, callback);
    try {
      await waitFor(() => expect(callback).toHaveBeenCalled());
      expect(callback.mock.lastCall[0][0].expr).toContain('avg by (job)');
    } finally {
      off();
      offPanel();
      offScene();
    }
  });
});

describe('isValidMetricSceneOptions', () => {
  test.each([
    { metric: '' },
    { metric: ' ' },
    { metric: 'bad"name' },
    { metric: 'bad\\name' },
    { metric: 'bad\nname' },
    { metric: 'bad{name}' },
    { metric: '${filters}' },
    { metric: '[[ds]]' },
    { dataSourceUid: '' },
    { dataSourceUid: '${ds}' },
    { from: '' },
    { from: NaN },
    { to: 'invalid' },
    { from: 1700003600001 },
    { customRateInterval: '' },
    { customRateInterval: '0s' },
    { customRateInterval: '5m]) or up' },
    { customRateInterval: '$__rate_interval' },
    { filters: [{ key: 'job', operator: 'or', value: 'foo' }] },
    { filters: [{ key: '__name__', operator: '=', value: 'other' }] },
    { filters: [{ key: 'job"', operator: '=', value: 'foo' }] },
    { filters: [{ key: 'job', operator: '=', value: 'foo', values: [] }] },
    { filters: [{ key: 'job', operator: '=', value: 'foo', values: ['bar'] }] },
    { filters: [{ key: 'job', operator: '=', value: 'foo', condition: 'OR' }] },
    { filters: [{ key: 'job', operator: '=', value: 'foo', condition: 'and' }] },
  ])('rejects unsafe or missing scope %j before creating any queries', (override) => {
    const options = { ...scope, ...override };
    expect(isValidMetricSceneOptions(options)).toBe(false);
    expect(() => createMetricScene(options)).toThrow('Invalid metric chart scope');
    expect(getDataSourceInstance).not.toHaveBeenCalled();
  });

  test.each([undefined, '', 'AND'])('accepts only the supported AND condition %j', (condition) => {
    const filter = { key: 'job', operator: '=', value: 'foo', condition };
    expect(isValidMetricSceneOptions({ ...scope, filters: [filter] })).toBe(true);
    const model = createMetricScene({ ...scope, filters: [filter] });
    expect(sceneGraph.interpolate(model.panel, '${filters:raw}')).toBe('job="foo"');
  });

  test.each(['http.server.duration', '🔥_temperature', 'namespace:metric'])(
    'accepts supported metric names %s',
    (metric) => {
      expect(
        isValidMetricSceneOptions({ ...scope, metric, from: 'now-1h', to: 'now', customRateInterval: '1h30m' })
      ).toBe(true);
    }
  );
});
