import { dateTime, LoadingState } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  EmbeddedScene,
  SceneDataNode,
  SceneDataTransformer,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';

import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { getTimeseriesQueryRunnerParams } from 'shared/GmdVizPanel/types/timeseries/getTimeseriesQueryRunnerParams';
import { buildFilterExpression } from 'shared/utils/utils.queries';

import { buildNotebookCapture } from './notebookCapture';
import { createMockDataSource } from '../../../../test/mocks/datasource';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

function createChart() {
  const filters = new AdHocFiltersVariable({
    name: 'filters',
    applyMode: 'manual',
    expressionBuilder: (values) => values.map(buildFilterExpression).join(','),
    filters: [{ key: 'job', operator: '=', value: 'api' }],
  });
  const datasource = new ConstantVariable({ name: 'ds', value: 'prom-a' });
  const queryParams = getTimeseriesQueryRunnerParams({
    metric: { name: 'http_requests_total', type: 'counter' },
    queryConfig: { resolution: QUERY_RESOLUTION.HIGH, labelMatchers: [], addIgnoreUsageFilter: true },
  });
  const runner = new SceneQueryRunner({ datasource: { uid: '${ds}' }, ...queryParams });
  const panel = new VizPanel({
    pluginId: 'timeseries',
    title: 'http_requests_total',
    $data: runner,
    options: { legend: { showLegend: true } },
    fieldConfig: { defaults: { unit: 'reqps' }, overrides: [] },
  });
  const timeRange = new SceneTimeRange({ from: 'now-1h', to: 'now', timeZone: 'America/Los_Angeles' });
  const root = new EmbeddedScene({
    $variables: new SceneVariableSet({ variables: [filters, datasource] }),
    $timeRange: timeRange,
    body: panel,
  });
  return { panel, runner, filters, datasource, timeRange, root };
}

describe('notebook capture', () => {
  beforeEach(() => {
    jest.mocked(getDataSourceSrv).mockReturnValue({
      getInstanceSettings: (uid: string) =>
        uid === 'prom-a' ? createMockDataSource({ uid, type: 'prometheus' }) : undefined,
    } as ReturnType<typeof getDataSourceSrv>);
  });

  it('exports the real main metric query with resolved filters, datasource, options and relative range', () => {
    const { panel } = createChart();

    expect(buildNotebookCapture(panel)).toEqual({
      panel: {
        type: 'timeseries',
        title: 'http_requests_total',
        targets: [
          expect.objectContaining({
            expr: 'sum(rate(http_requests_total{ job="api"}[$__rate_interval]))',
            fromExploreMetrics: false,
            datasource: { uid: 'prom-a', type: 'prometheus' },
          }),
        ],
        datasource: { uid: 'prom-a', type: 'prometheus' },
        options: { legend: { showLegend: true } },
        fieldConfig: { defaults: { unit: 'reqps' }, overrides: [] },
        maxDataPoints: 500,
      },
      capturedTimeRange: { from: 'now-1h', to: 'now', timeZone: 'America/Los_Angeles' },
    });
  });

  it('preserves ISO absolute instants and resolves the browser timezone at capture', () => {
    const { panel, timeRange } = createChart();
    timeRange.onTimeRangeChange({
      from: dateTime('2026-10-05T08:00:00.000Z'),
      to: dateTime('2026-10-05T09:30:00.000Z'),
      raw: { from: dateTime('2026-10-05T08:00:00.000Z'), to: dateTime('2026-10-05T09:30:00.000Z') },
    });
    timeRange.setState({ timeZone: 'browser' });

    expect(buildNotebookCapture(panel).capturedTimeRange).toEqual({
      from: '2026-10-05T08:00:00.000Z',
      to: '2026-10-05T09:30:00.000Z',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });

  it('keeps queries, datasource, options, filters and time independent of later scene changes', () => {
    const { panel, runner, filters, datasource, timeRange } = createChart();
    const capture = buildNotebookCapture(panel);
    runner.setState({ queries: [{ refId: 'B', expr: 'different_metric' }] });
    filters.setState({ filters: [{ key: 'job', operator: '=', value: 'other' }] });
    datasource.setState({ value: 'prom-b' });
    timeRange.setState({ from: 'now-7d', timeZone: 'UTC' });
    panel.state.fieldConfig.defaults.unit = 'bytes';
    panel.state.options.legend!.showLegend = false;
    panel.setState({ title: 'other metric' });

    expect(capture.panel.title).toBe('http_requests_total');
    expect(capture.panel.targets?.[0]).toMatchObject({
      expr: 'sum(rate(http_requests_total{ job="api"}[$__rate_interval]))',
      datasource: { uid: 'prom-a', type: 'prometheus' },
    });
    expect(capture.panel.fieldConfig?.defaults.unit).toBe('reqps');
    expect(capture.panel.options).toEqual({ legend: { showLegend: true } });
    expect(capture.capturedTimeRange).toEqual({ from: 'now-1h', to: 'now', timeZone: 'America/Los_Angeles' });
  });

  it('rejects custom transformations instead of silently dropping them', () => {
    const { panel, runner } = createChart();
    panel.setState({ $data: new SceneDataTransformer({ $data: runner.clone(), transformations: [] }) });
    expect(() => buildNotebookCapture(panel)).toThrow('without custom data transformations');
  });

  it('rejects pre-fetched data without an exportable query', () => {
    const { panel, timeRange } = createChart();
    panel.setState({
      $data: new SceneDataNode({ data: { state: LoadingState.Done, series: [], timeRange: timeRange.state.value } }),
    });
    expect(() => buildNotebookCapture(panel)).toThrow('direct query runner');
  });

  it.each([
    { queries: [] },
    { queries: [{ refId: 'A', expr: '' }] },
    { queries: [{ refId: 'A', expr: '$unknown{job="api"}' }] },
    { queries: [{ refId: 'A', expr: 'up', datasource: { uid: 'prom-b' } }] },
    { datasource: { uid: 'unresolved' } },
  ])('rejects unresolved or unsupported queries: %j', (state) => {
    const { panel, runner } = createChart();
    runner.setState(state);
    expect(() => buildNotebookCapture(panel)).toThrow();
  });
});
