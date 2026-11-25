import { FieldType, LoadingState, type DataFrame, type TimeRange } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/plugin-compat/datasources';
import { sceneGraph, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

import { MetricValueBreakdown, type MetricValueBreakdownProps } from './MetricValueBreakdown';
import * as metricScene from '../metrics-molecules/metricScene';

jest.mock('@grafana/plugin-compat/datasources', () => ({ getDataSourceInstance: jest.fn() }));
jest.mock('../metrics-molecules/metricScene', () => ({
  ...jest.requireActual('../metrics-molecules/metricScene'),
  createMetricScene: jest.fn(),
}));

// Keep host UI rendering independent of jsdom canvas/virtual-list measurement.
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Combobox: ({
    id,
    value,
    options,
    onChange,
  }: {
    id: string;
    value: { value: string };
    options: Array<{ value: string; label: string }>;
    onChange: (option: { value: string }) => void;
  }) => (
    <select id={id} value={value.value} onChange={(event) => onChange({ value: event.target.value })}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

const create = jest.requireActual<typeof metricScene>('../metrics-molecules/metricScene').createMetricScene;

const props: MetricValueBreakdownProps = {
  dataSourceUid: 'prom-a',
  metric: 'temperature',
  from: 1700000000000,
  to: 1700003600000,
  label: 'job',
  onLabelChange: jest.fn(),
};
const labels = jest.fn<Promise<string[]>, [TimeRange, string]>();
let models: Array<ReturnType<typeof metricScene.createMetricScene>>;

function frame(value: string | undefined, values: Array<number | null> = [1, 2]): DataFrame {
  return {
    length: values.length,
    fields: [
      { name: 'Time', type: FieldType.time, config: {}, values: values.map((_, index) => index * 1000) },
      { name: 'Value', type: FieldType.number, config: {}, values, labels: value === undefined ? {} : { job: value } },
    ],
  };
}
function runner(model = models[0]) {
  return sceneGraph.findDescendents(model.panel.state.body!, SceneQueryRunner)[0];
}
async function resolveModel(index = 0) {
  await waitFor(() => expect(models[index].panel.state.metricTypeResolved).toBe(true));
  return models[index];
}
function publish(series: DataFrame[], model = models[0], state = LoadingState.Done) {
  act(() =>
    runner(model).setState({ data: { state, series, timeRange: sceneGraph.getTimeRange(model.scene).state.value } })
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  models = [];
  labels.mockResolvedValue(['__name__', 'le', 'job', 'zone']);
  jest.spyOn(VizPanel.prototype as unknown as { _onActivate: () => void }, '_onActivate').mockImplementation(() => {});
  jest.mocked(metricScene.createMetricScene).mockImplementation((...args) => {
    const model = create(...args);
    models.push(model);
    return model;
  });
  jest.mocked(getDataSourceInstance).mockImplementation(
    async (ref, vars) =>
      ({
        type: 'prometheus',
        uid: typeof ref === 'object' ? ref?.uid : sceneGraph.interpolate(vars?.__sceneObject?.value, '${ds}'),
        languageProvider: {
          request: async () => ({ temperature: [{ type: 'gauge' }], new_temperature: [{ type: 'gauge' }] }),
          queryLabelKeys: labels,
        },
      }) as any
  );
  jest.spyOn(SceneQueryRunner.prototype, 'runQueries').mockImplementation(() => {});
  jest
    .spyOn(VizPanel, 'Component')
    .mockImplementation(({ model }) => (
      <div data-testid="value-chart">
        {sceneGraph.getData(model).state.data?.series[0].fields[1].labels?.job || '(empty label value)'}
      </div>
    ));
});
afterEach(() => jest.restoreAllMocks());

test('discovers scoped label names and keeps label selection controlled', async () => {
  const onLabelChange = jest.fn();
  const onQueriesChange = jest.fn();
  render(
    <MetricValueBreakdown
      {...props}
      filters={[{ key: 'zone', operator: '=', value: '${ds}-"x' }]}
      onLabelChange={onLabelChange}
      onQueriesChange={onQueriesChange}
    />
  );
  const model = await resolveModel();
  await waitFor(() => expect(labels).toHaveBeenCalled());
  expect(labels.mock.calls[0]).toEqual([
    model.scene.state.$timeRange!.state.value,
    'temperature{zone="\\u0024{ds}-\\"x"}',
  ]);
  expect(onQueriesChange.mock.lastCall[0][0].expr).toBe('avg by (job) (temperature{ zone="\\u0024{ds}-\\"x"})');
  const picker = screen.getByRole('combobox', { name: 'Break down by label' });
  await screen.findByRole('option', { name: 'zone' });
  expect(screen.queryByRole('option', { name: 'le' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: '__name__' })).not.toBeInTheDocument();
  fireEvent.change(picker, { target: { value: 'zone' } });
  expect(onLabelChange).toHaveBeenCalledWith('zone');
  expect(model.panel.state.queryConfig.groupBy).toBe('job');
  expect(models).toHaveLength(1);
});

test('bounds alphabetical static charts, uses shared axes, and never fans out queries', async () => {
  render(<MetricValueBreakdown {...props} maxValues={2} />);
  await resolveModel();
  const source = runner();
  const runCount = jest.mocked(SceneQueryRunner.prototype.runQueries).mock.calls.length;
  publish([frame('z'), frame('b', [7, 20]), frame('a', [-3, 2])]);
  expect(screen.getAllByTestId('value-chart').map((element) => element.textContent)).toEqual(['a', 'b']);
  expect(screen.getByText('1 sampled values omitted (display limit 2).')).toBeInTheDocument();
  expect(sceneGraph.findDescendents(models[0].scene, SceneQueryRunner)).toEqual([source]);
  expect(SceneQueryRunner.prototype.runQueries).toHaveBeenCalledTimes(runCount);
  const panels = sceneGraph
    .findDescendents(models[0].scene, VizPanel)
    .filter((panel) => panel !== models[0].panel.state.body);
  expect(panels).toHaveLength(2);
  for (const panel of panels) {
    expect(panel.state.fieldConfig.defaults).toMatchObject({ min: -3, max: 20 });
  }
});

test('changing the display limit preserves pending metadata, query observers and the active runner', async () => {
  const metadata = deferred<unknown>();
  jest.mocked(getDataSourceInstance).mockResolvedValue({
    uid: 'prom-a',
    type: 'prometheus',
    languageProvider: { request: () => metadata.promise, queryLabelKeys: labels },
  } as any);
  const onQueriesChange = jest.fn();
  const { rerender } = render(<MetricValueBreakdown {...props} maxValues={1} onQueriesChange={onQueriesChange} />);
  const source = runner();
  const initialRuns = jest.mocked(SceneQueryRunner.prototype.runQueries).mock.calls.length;
  rerender(<MetricValueBreakdown {...props} maxValues={2} onQueriesChange={onQueriesChange} />);
  expect(runner()).toBe(source);
  expect(SceneQueryRunner.prototype.runQueries).toHaveBeenCalledTimes(initialRuns);

  await act(async () => metadata.resolve({ temperature: [{ type: 'counter' }] }));
  await resolveModel();
  expect(onQueriesChange.mock.lastCall[0][0].expr).toContain('sum by (job) (rate(temperature');
  publish([frame('a'), frame('b'), frame('c')]);
  expect(screen.getAllByTestId('value-chart')).toHaveLength(2);
  const resolvedRuns = jest.mocked(SceneQueryRunner.prototype.runQueries).mock.calls.length;

  rerender(<MetricValueBreakdown {...props} maxValues={1} onQueriesChange={onQueriesChange} />);
  expect(screen.getAllByTestId('value-chart')).toHaveLength(1);
  expect(screen.getByText('2 sampled values omitted (display limit 1).')).toBeInTheDocument();
  expect(runner()).toBe(source);
  expect(source.isActive).toBe(true);
  expect(SceneQueryRunner.prototype.runQueries).toHaveBeenCalledTimes(resolvedRuns);
  act(() => source.setState({ queries: [{ refId: 'changed', expr: 'sum by (job) (temperature{})' }] }));
  expect(onQueriesChange.mock.lastCall[0][0].refId).toBe('changed');
});

test.each([
  ['traffic_bytes', 'counter', 'Bps'],
  ['traffic_bytes_total', 'gauge', 'bytes'],
])('uses metadata-corrected units for %s resolved as %s', async (metric, type, unit) => {
  jest.mocked(getDataSourceInstance).mockResolvedValue({
    uid: 'prom-a',
    type: 'prometheus',
    languageProvider: { request: async () => ({ [metric]: [{ type }] }), queryLabelKeys: labels },
  } as any);
  render(<MetricValueBreakdown {...props} metric={metric} />);
  const model = await resolveModel();
  publish([frame('a')]);
  const panels = sceneGraph.findDescendents(model.scene, VizPanel).filter((panel) => panel !== model.panel.state.body);
  expect(panels).toHaveLength(1);
  expect(panels[0].state.fieldConfig.defaults.unit).toBe(unit);
});

test.each([undefined, 100])('uses the default or hard display cap for maxValues=%s', async (maxValues) => {
  render(<MetricValueBreakdown {...props} maxValues={maxValues} />);
  await resolveModel();
  publish(Array.from({ length: 30 }, (_, index) => frame(String(index).padStart(2, '0'))));
  expect(screen.getAllByTestId('value-chart')).toHaveLength(maxValues === undefined ? 6 : 24);
});

test('filter callbacks preserve literal values including empty and sentinel-looking values', async () => {
  const onFilterSelect = jest.fn();
  render(<MetricValueBreakdown {...props} onFilterSelect={onFilterSelect} />);
  await resolveModel();
  publish([frame(undefined), frame('<unspecified>'), frame('${ds}"\\\n')]);
  for (const [index, value] of ['', '${ds}"\\\n', '<unspecified>'].entries()) {
    const section = screen.getAllByRole('region')[index];
    expect(section.getAttribute('aria-label')).toBe(value || '(empty label value)');
    fireEvent.click(within(section).getByRole('button'));
    expect(onFilterSelect).toHaveBeenLastCalledWith({ key: 'job', operator: '=', value });
  }
});

test('preserves sparse samples and explicitly shows no samples without fabricating zero data', async () => {
  render(<MetricValueBreakdown {...props} />);
  await resolveModel();
  publish([frame('sparse', [null, 3]), frame('no-samples', [null, null]), frame('empty-frame', [])]);
  expect(screen.getAllByTestId('value-chart')).toHaveLength(1);
  expect(screen.getByTestId('value-chart')).toHaveTextContent('sparse');
  expect(screen.getAllByText(/No samples in this time range/)).toHaveLength(2);
  expect(screen.getByText(/not an exhaustive list/)).toBeInTheDocument();
  const staticPanel = sceneGraph
    .findDescendents(models[0].scene, VizPanel)
    .find((panel) => sceneGraph.getData(panel).state.data?.series[0]?.fields[1].labels?.job === 'sparse')!;
  expect(sceneGraph.getData(staticPanel).state.data?.series[0].fields[1].values).toEqual([null, 3]);
});

test('two instances isolate queries, values and filter callbacks', async () => {
  const a = jest.fn();
  const b = jest.fn();
  render(
    <>
      <MetricValueBreakdown {...props} onFilterSelect={a} />
      <MetricValueBreakdown
        {...props}
        dataSourceUid="prom-b"
        from={1800000000000}
        to={1800003600000}
        onFilterSelect={b}
      />
    </>
  );
  await resolveModel(0);
  await resolveModel(1);
  publish([frame('a')], models[0]);
  publish([frame('b')], models[1]);
  fireEvent.click(within(screen.getByRole('region', { name: 'b' })).getByRole('button'));
  expect(a).not.toHaveBeenCalled();
  expect(b).toHaveBeenCalledWith({ key: 'job', operator: '=', value: 'b' });
  expect(models[0].scene.state.$timeRange!.state.value.from.valueOf()).toBe(props.from);
  expect(models[1].scene.state.$timeRange!.state.value.from.valueOf()).toBe(1800000000000);
});

test('scope changes and unmount disconnect stale label requests, runner results and callbacks', async () => {
  const oldLabels = deferred<string[]>();
  const nextLabels = deferred<string[]>();
  labels.mockImplementationOnce(() => oldLabels.promise).mockImplementationOnce(() => nextLabels.promise);
  const oldCallback = jest.fn();
  const newCallback = jest.fn();
  const { rerender, unmount } = render(<MetricValueBreakdown {...props} onQueriesChange={oldCallback} />);
  await resolveModel();
  publish([frame('old')]);
  const oldRunner = runner();
  rerender(
    <MetricValueBreakdown
      {...props}
      metric="new_temperature"
      dataSourceUid="prom-b"
      label="zone"
      onQueriesChange={newCallback}
    />
  );
  await resolveModel(1);
  const calls = oldCallback.mock.calls.length;
  act(() => oldRunner.setState({ queries: [{ refId: 'stale', expr: 'stale' }] }));
  publish([frame('stale')], models[0]);
  await act(async () => oldLabels.resolve(['stale-label']));
  expect(screen.queryByText('old', { selector: 'h3' })).not.toBeInTheDocument();
  expect(screen.queryByText('stale', { selector: 'h3' })).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'stale-label' })).not.toBeInTheDocument();
  expect(oldRunner.isActive).toBe(false);
  expect(oldCallback).toHaveBeenCalledTimes(calls);
  const newCalls = newCallback.mock.calls.length;
  unmount();
  await act(async () => nextLabels.resolve(['late-label']));
  act(() => runner(models[1]).setState({ queries: [{ refId: 'late', expr: 'late' }] }));
  expect(newCallback).toHaveBeenCalledTimes(newCalls);
  expect(runner(models[1]).isActive).toBe(false);
});

test('renders loading, terminal query errors and empty states', async () => {
  render(<MetricValueBreakdown {...props} />);
  expect(screen.getByLabelText('Loading breakdown')).toBeInTheDocument();
  await resolveModel();
  publish([], models[0], LoadingState.Error);
  expect(screen.getByText('Unable to load breakdown')).toBeInTheDocument();
  publish([]);
  expect(screen.getByText('No samples in this time range')).toBeInTheDocument();
});

test.each([
  { label: '' },
  { label: '${ds}' },
  { label: '__name__' },
  { label: 'le' },
  { metric: '' },
  { maxValues: 0 },
])('rejects invalid required inputs %j', (override) => {
  render(<MetricValueBreakdown {...props} {...override} />);
  expect(screen.getByText('Invalid metric breakdown scope or label')).toBeInTheDocument();
  expect(getDataSourceInstance).not.toHaveBeenCalled();
});

test('late metadata cannot activate an old scope or emit queries to the old host', async () => {
  const oldMetadata = deferred<unknown>();
  const newMetadata = deferred<unknown>();
  jest.mocked(getDataSourceInstance).mockImplementation(async (ref, vars) => {
    const uid = typeof ref === 'object' ? ref?.uid : sceneGraph.interpolate(vars?.__sceneObject?.value, '${ds}');
    return {
      uid,
      type: 'prometheus',
      languageProvider: {
        request: () => (uid === 'prom-a' ? oldMetadata.promise : newMetadata.promise),
        queryLabelKeys: labels,
      },
    } as any;
  });
  const oldCallback = jest.fn();
  const newCallback = jest.fn();
  const { rerender, unmount } = render(<MetricValueBreakdown {...props} onQueriesChange={oldCallback} />);
  rerender(
    <MetricValueBreakdown
      {...props}
      dataSourceUid="prom-b"
      from={1800000000000}
      to={1800003600000}
      filters={[{ key: 'zone', operator: '=', value: 'b' }]}
      onQueriesChange={newCallback}
    />
  );
  await act(async () => oldMetadata.resolve({ temperature: [{ type: 'histogram' }] }));
  expect(oldCallback).not.toHaveBeenCalled();
  expect(newCallback).not.toHaveBeenCalled();
  expect(runner(models[0]).isActive).toBe(false);
  await act(async () => newMetadata.resolve({ temperature: [{ type: 'counter' }] }));
  await resolveModel(1);
  expect(newCallback.mock.lastCall[0][0]).toMatchObject({ datasource: { uid: 'prom-b' } });
  expect(newCallback.mock.lastCall[0][0].expr).toBe('sum by (job) (rate(temperature{ zone="b"}[$__rate_interval]))');
  expect(labels.mock.calls[1][0].from.valueOf()).toBe(1800000000000);
  expect(labels.mock.calls[1][1]).toBe('temperature{zone="b"}');
  unmount();
  expect(runner(models[1]).isActive).toBe(false);
});

test('label discovery errors remain visible without discarding successful range data', async () => {
  labels.mockRejectedValueOnce(new Error('unavailable'));
  render(<MetricValueBreakdown {...props} />);
  await resolveModel();
  await screen.findByText('Unable to load label names');
  publish([frame('a')]);
  expect(screen.getByTestId('value-chart')).toHaveTextContent('a');
});

test('callback replacement does not rebuild the scope or reactivate queries', async () => {
  const oldCallback = jest.fn();
  const nextCallback = jest.fn();
  const oldFilter = jest.fn();
  const nextFilter = jest.fn();
  const { rerender } = render(
    <MetricValueBreakdown {...props} onQueriesChange={oldCallback} onFilterSelect={oldFilter} />
  );
  await resolveModel();
  publish([frame('a')]);
  const runCount = jest.mocked(SceneQueryRunner.prototype.runQueries).mock.calls.length;
  rerender(<MetricValueBreakdown {...props} onQueriesChange={nextCallback} onFilterSelect={nextFilter} />);
  fireEvent.click(within(screen.getByRole('region', { name: 'a' })).getByRole('button'));
  expect(oldFilter).not.toHaveBeenCalled();
  expect(nextFilter).toHaveBeenCalledWith({ key: 'job', operator: '=', value: 'a' });
  expect(nextCallback).toHaveBeenCalledTimes(1);
  expect(models).toHaveLength(1);
  expect(SceneQueryRunner.prototype.runQueries).toHaveBeenCalledTimes(runCount);
});
