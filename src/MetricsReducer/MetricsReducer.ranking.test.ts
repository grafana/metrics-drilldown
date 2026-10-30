import { CustomVariable, sceneGraph } from '@grafana/scenes';

import { getTrailFor } from 'shared/utils/utils';

import { fetchCatalogRanking } from './list-controls/JevSort/fetchCatalogRanking';
import { type CatalogResponse } from './list-controls/JevSort/ranking';
import { EventSortByChanged } from './list-controls/MetricsSorter/events/EventSortByChanged';
import { MetricsSorter, VAR_WINGMAN_SORT_BY } from './list-controls/MetricsSorter/MetricsSorter';
import { EventQuickSearchChanged } from './list-controls/QuickSearch/EventQuickSearchChanged';
import { EventMetricsVariableActivated } from './metrics-variables/events/EventMetricsVariableActivated';
import { EventMetricsVariableDeactivated } from './metrics-variables/events/EventMetricsVariableDeactivated';
import { EventMetricsVariableLoaded } from './metrics-variables/events/EventMetricsVariableLoaded';
import { VAR_FILTERED_METRICS_VARIABLE } from './metrics-variables/FilteredMetricsVariable';
import { MetricsReducer } from './MetricsReducer';

jest.mock('./list-controls/JevSort/fetchCatalogRanking');
jest.mock('shared/utils/utils', () => ({
  getTrailFor: jest.fn(),
  getObjectKeys: Object.keys,
  getObjectValues: Object.values,
  embeddedTrailNamespace: 'gmd',
}));
jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    sceneGraph: {
      ...actual.sceneGraph,
      findByKey: jest.fn(),
      findByKeyAndType: jest.fn(),
      lookupVariable: jest.fn(),
      getTimeRange: jest.fn(),
    },
  };
});

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  localStorage.setItem('gmd.jev.enabled', '1');
});
afterEach(() => {
  jest.useRealTimers();
  localStorage.clear();
});

function setup() {
  const reducer = new MetricsReducer();
  const sorter = new MetricsSorter({});
  (sorter.state.$variables.getByName(VAR_WINGMAN_SORT_BY) as CustomVariable).changeValueTo('jev-relevance');
  const variables = new Map<string, CustomVariable>();
  const names = ['a_ordinary', 'b_ordinary', 'z_incident', 'z_other_incident'];
  const catalog = new CustomVariable({ name: VAR_FILTERED_METRICS_VARIABLE });
  variables.set(VAR_FILTERED_METRICS_VARIABLE, catalog);
  jest.mocked(sceneGraph.findByKey).mockImplementation((_, key) => variables.get(key)!);
  jest.mocked(sceneGraph.findByKeyAndType).mockImplementation((_, key) => {
    if (key === 'metrics-sorter') {
      return sorter as never;
    }
    if (key === 'quick-search') {
      return { state: { value: '' } } as never;
    }
    throw new Error('Optional filter not present');
  });
  jest
    .mocked(sceneGraph.lookupVariable)
    .mockImplementation((name) =>
      name === VAR_FILTERED_METRICS_VARIABLE ? catalog : ({ getValue: () => 'prom', state: { filters: [] } } as never)
    );
  jest.mocked(sceneGraph.getTimeRange).mockReturnValue({
    state: { value: { from: new Date(1), to: new Date(2) } },
  } as never);
  jest.mocked(getTrailFor).mockReturnValue({
    peekMetricMetadata: () => undefined,
    getMetricLabelNames: async () => [],
  } as never);
  jest.spyOn(sorter, 'getSloMetricSignals').mockResolvedValue({
    datasourceUid: 'prom',
    status: 'ready',
    burnStatus: 'ready',
    trackedMetrics: new Map(),
    activeBurnMetrics: new Set(['z_incident', 'z_other_incident']),
  });
  jest.spyOn(sorter, 'peekUsageCounts').mockReturnValue({});
  (reducer as unknown as { initVariablesFilteringAndSorting: () => void }).initVariablesFilteringAndSorting();
  function load(key: string, metrics: string[]) {
    const variable = variables.get(key) ?? new CustomVariable({ name: key });
    variables.set(key, variable);
    const options = metrics.map((value) => ({ value, label: value }));
    variable.setState({ options });
    reducer.publishEvent(new EventMetricsVariableActivated({ key }));
    reducer.publishEvent(new EventMetricsVariableLoaded({ key, options }));
    return variable;
  }
  load(VAR_FILTERED_METRICS_VARIABLE, names);
  const first = load('row-one', ['a_ordinary', 'z_incident']);
  const second = load('row-two', ['b_ordinary', 'z_other_incident']);
  return { reducer, sorter, catalog, first, second, load };
}
const order = (variable: CustomVariable) => variable.state.options.map(({ value }) => value);

it('shares one catalog request across rows, including late subscribers, without cancelling on row removal', async () => {
  let finish!: (response: CatalogResponse) => void;
  jest.mocked(fetchCatalogRanking).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { reducer, sorter, first, second, load } = setup();
  await jest.advanceTimersByTimeAsync(200);
  expect(order(first)).toEqual(['z_incident', 'a_ordinary']);
  expect(order(second)).toEqual(['z_other_incident', 'b_ordinary']);
  const late = load('row-three', ['a_ordinary', 'z_other_incident']);
  expect(order(late)).toEqual(['z_other_incident', 'a_ordinary']);
  expect(fetchCatalogRanking).toHaveBeenCalledTimes(1);
  expect(jest.mocked(fetchCatalogRanking).mock.calls[0][0].candidates).toHaveLength(4);
  reducer.publishEvent(new EventMetricsVariableDeactivated({ key: 'row-one' }));
  first.setState({ options: [{ label: 'disposed', value: 'disposed' }] });
  expect(jest.mocked(fetchCatalogRanking).mock.calls[0][1].aborted).toBe(false);
  finish({ status: 'upstream_error', scores: {} });
  await jest.advanceTimersByTimeAsync(0);
  expect(order(first)).toEqual(['disposed']);
  expect(order(second)).toEqual(['z_other_incident', 'b_ordinary']);
  expect(order(late)).toEqual(['z_other_incident', 'a_ordinary']);
  expect(sorter.state.ranking.state.total).toBe(4);
});

it('applies filters to the whole shared catalog before reranking and rejects late work after ordinary sorting', async () => {
  let finish!: (response: CatalogResponse) => void;
  jest.mocked(fetchCatalogRanking).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { reducer, catalog, first, second } = setup();
  reducer.publishEvent(new EventQuickSearchChanged({ searchText: 'ordinary' }));
  await jest.advanceTimersByTimeAsync(200);
  expect(jest.mocked(fetchCatalogRanking).mock.calls[0][0].candidates.map(({ name }) => name)).toEqual([
    'a_ordinary',
    'b_ordinary',
  ]);
  reducer.publishEvent(new EventSortByChanged({ sortBy: 'alphabetical-reversed' }));
  expect(jest.mocked(fetchCatalogRanking).mock.calls[0][1].aborted).toBe(true);
  finish({ status: 'upstream_error', scores: {} });
  await jest.advanceTimersByTimeAsync(0);
  expect(order(catalog)).toEqual(['b_ordinary', 'a_ordinary']);
  expect(order(first)).toEqual(['a_ordinary']);
  expect(order(second)).toEqual(['b_ordinary']);
});
