import { sceneGraph } from '@grafana/scenes';

import { getTrailFor } from 'shared/utils/utils';

import { type MetricsSorter } from '../../MetricsSorter/MetricsSorter';
import { CatalogRanking } from '../CatalogRanking';
import { fetchCatalogRanking } from '../fetchCatalogRanking';
import { type CatalogResponse } from '../ranking';

jest.mock('../fetchCatalogRanking');
jest.mock('shared/utils/utils', () => ({
  getTrailFor: jest.fn(),
  getObjectValues: Object.values,
  getObjectKeys: Object.keys,
  embeddedTrailNamespace: 'gmd',
}));
jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return { ...actual, sceneGraph: { ...actual.sceneGraph, getTimeRange: jest.fn(), lookupVariable: jest.fn() } };
});

const response = (): CatalogResponse => ({
  status: 'ok',
  scores: { c02: { utility: 0.8, probabilities: { high_value: 0.8, supporting: 0, low_value: 0.2, unknown: 0 } } },
});
function setup() {
  const labels = jest.fn().mockResolvedValue([]);
  jest
    .mocked(getTrailFor)
    .mockReturnValue({ peekMetricMetadata: () => undefined, getMetricLabelNames: labels } as never);
  jest.mocked(sceneGraph.lookupVariable).mockReturnValue({ getValue: () => 'prom', state: { filters: [] } } as never);
  jest
    .mocked(sceneGraph.getTimeRange)
    .mockReturnValue({ state: { value: { from: new Date(1), to: new Date(2) } } } as never);
  const sorter = {
    getSloMetricSignals: jest.fn().mockResolvedValue({
      status: 'ready',
      burnStatus: 'ready',
      trackedMetrics: new Map(),
      activeBurnMetrics: new Set(),
    }),
    peekUsageCounts: () => ({}),
    getSignalFetchedAt: () => Date.now(),
  } as unknown as MetricsSorter;
  return { sorter, labels };
}
async function debounce() {
  await jest.advanceTimersByTimeAsync(200);
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.setItem('gmd.jev.enabled', '1');
});
afterEach(() => {
  jest.useRealTimers();
  localStorage.removeItem('gmd.jev.enabled');
});

it('ranks actual candidates and reuses a completed response on toggle comparisons', async () => {
  const { sorter } = setup();
  jest.mocked(fetchCatalogRanking).mockResolvedValue(response());
  const model = new CatalogRanking();
  const baseline = jest.fn();
  const first = model.rank(['a', 'b', 'c'], sorter, {}, baseline);
  await debounce();
  expect(await first).toEqual(['b', 'a', 'c']);
  expect(baseline).toHaveBeenCalledWith(['a', 'b', 'c']);
  model.cancel();
  const second = model.rank(['a', 'b', 'c'], sorter, {}, baseline);
  await debounce();
  expect(await second).toEqual(['b', 'a', 'c']);
  expect(fetchCatalogRanking).toHaveBeenCalledTimes(1);
  expect(model.state.response?.cached).toBe(true);
});

it('keeps local bands on transport failure, without claiming Jev succeeded', async () => {
  const { sorter } = setup();
  jest.mocked(sorter.getSloMetricSignals).mockResolvedValue({
    status: 'ready',
    burnStatus: 'error',
    datasourceUid: 'prom',
    trackedMetrics: new Map([['c', new Set(['slo'])]]),
    activeBurnMetrics: new Set(),
  });
  jest.mocked(fetchCatalogRanking).mockRejectedValue(new Error('timeout'));
  const model = new CatalogRanking();
  const result = model.rank(['a', 'b', 'c'], sorter, {}, jest.fn());
  await debounce();
  expect(await result).toEqual(['c', 'a', 'b']);
  expect(model.state.status).toBe('fallback');
  expect(model.state.snapshot?.burnStatus).toBe('error');
});

it('ignores late work after context change and coalesces repeated in-flight signatures', async () => {
  const { sorter } = setup();
  let resolve!: (response: CatalogResponse) => void;
  jest
    .mocked(fetchCatalogRanking)
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    )
    .mockResolvedValue(response());
  const model = new CatalogRanking();
  const first = model.rank(['a', 'b'], sorter, {}, jest.fn());
  expect(model.rank(['a', 'b'], sorter, {}, jest.fn())).toBe(first);
  await debounce();
  const next = model.rank(['c', 'd'], sorter, {}, jest.fn());
  await debounce();
  expect(await next).toEqual(['d', 'c']);
  resolve(response());
  await first;
  expect(model.state.request?.candidates.map((c) => c.name)).toEqual(['c', 'd']);
  expect(model.state.status).toBe('ready');
});

it('does no signal, label or Jev work for disabled mode or zero candidates', async () => {
  const { sorter, labels } = setup();
  const model = new CatalogRanking();
  localStorage.removeItem('gmd.jev.enabled');
  expect(await model.rank(['b', 'a'], sorter, {}, jest.fn())).toEqual(['a', 'b']);
  localStorage.setItem('gmd.jev.enabled', '1');
  expect(await model.rank([], sorter, {}, jest.fn())).toEqual([]);
  expect(sorter.getSloMetricSignals).not.toHaveBeenCalled();
  expect(labels).not.toHaveBeenCalled();
  expect(fetchCatalogRanking).not.toHaveBeenCalled();
});
