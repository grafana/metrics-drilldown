import { config } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';

import { PREF_KEYS } from 'shared/user-preferences/pref-keys';
import { userStorage } from 'shared/user-preferences/userStorage';
import { getTrailFor } from 'shared/utils/utils';

import { EventSortByChanged } from '../../MetricsSorter/events/EventSortByChanged';
import { type MetricsSorter } from '../../MetricsSorter/MetricsSorter';
import { CatalogRanking } from '../CatalogRanking';
import { fetchCatalogRanking } from '../fetchCatalogRanking';
import { PERSONAL_SIGNALS_CHANGED, personalStorageKey, recordMetricVisit } from '../personalization';
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

const originalUser = config.bootData.user;
beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  localStorage.setItem('gmd.jev.enabled', '1');
  config.bootData.user = { ...originalUser, isSignedIn: true, id: 7, orgId: 3 };
});
afterEach(() => {
  jest.useRealTimers();
  config.bootData.user = originalUser;
  localStorage.clear();
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

it('does not use legacy recents to influence the Jev baseline or shortlist order', async () => {
  const { sorter } = setup();
  userStorage.setItem(PREF_KEYS.RECENT_METRICS, [{ name: 'c', timestamp: Date.now() }]);
  jest.mocked(fetchCatalogRanking).mockResolvedValue({ status: 'upstream_error', scores: {} });
  const model = new CatalogRanking();
  const result = model.rank(['a', 'b', 'c'], sorter, {}, jest.fn());
  await debounce();
  expect(await result).toEqual(['a', 'b', 'c']);
});

it('keeps scoped personal fallback when SLO acquisition times out', async () => {
  const { sorter } = setup();
  recordMetricVisit('prom', 'b');
  jest.mocked(sorter.getSloMetricSignals).mockReturnValue(new Promise(() => {}));
  const model = new CatalogRanking();
  const result = model.rank(['a', 'b'], sorter, {}, jest.fn());
  await jest.advanceTimersByTimeAsync(1700);
  expect(await result).toEqual(['b', 'a']);
  expect(model.state.status).toBe('fallback');
  expect(model.state.baseline[0].personalBoost).toBeGreaterThan(0);
  expect(fetchCatalogRanking).not.toHaveBeenCalled();
});

it('supersedes in-flight work when personal evidence changes, without leaking it into requests', async () => {
  const { sorter } = setup();
  let resolve!: (value: CatalogResponse) => void;
  jest
    .mocked(fetchCatalogRanking)
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    )
    .mockResolvedValue({ status: 'upstream_error', scores: {} });
  const model = new CatalogRanking();
  const first = model.rank(['a', 'b'], sorter, {}, jest.fn());
  await debounce();
  recordMetricVisit('prom', 'b');
  const next = model.rank(['a', 'b'], sorter, {}, jest.fn());
  expect(next).not.toBe(first);
  await debounce();
  expect(await next).toEqual(['b', 'a']);
  resolve(response());
  await first;
  expect(model.state.baseline[0].name).toBe('b');
  const payload = JSON.stringify(jest.mocked(fetchCatalogRanking).mock.calls[1][0]);
  for (const privateField of ['historyBoosts', 'bookmarks', 'personalBoost', 'orgId', 'viewedAt', 'userId']) {
    expect(payload).not.toContain(privateField);
  }
});

it('rebuilds merged personal order while reusing the unchanged semantic response', async () => {
  const { sorter } = setup();
  jest.mocked(fetchCatalogRanking).mockResolvedValue({
    status: 'ok',
    scores: {
      c01: { utility: 0.7, probabilities: { high_value: 0.7, supporting: 0, low_value: 0.3, unknown: 0 } },
      c02: { utility: 0.69, probabilities: { high_value: 0.69, supporting: 0, low_value: 0.31, unknown: 0 } },
    },
  });
  const model = new CatalogRanking();
  const first = model.rank(['custom_requests_total', 'b'], sorter, {}, jest.fn());
  await debounce();
  expect(await first).toEqual(['custom_requests_total', 'b']);
  recordMetricVisit('prom', 'b');
  const next = model.rank(['custom_requests_total', 'b'], sorter, {}, jest.fn());
  await debounce();
  expect(await next).toEqual(['b', 'custom_requests_total']);
  expect(fetchCatalogRanking).toHaveBeenCalledTimes(1);
  expect(model.state.response?.cached).toBe(true);
});

it('listens only to active matching scoped changes and removes listeners on deactivate', () => {
  setup();
  const model = new CatalogRanking();
  const publish = jest.spyOn(model, 'publishEvent');
  const sortEventCount = () => publish.mock.calls.filter(([event]) => event instanceof EventSortByChanged).length;
  const deactivate = model.activate();
  const matching = personalStorageKey('prom')!;
  recordMetricVisit('prom', 'a');
  expect(sortEventCount()).toBe(0); // hidden/ordinary mode
  model.setState({ status: 'loading' });
  recordMetricVisit('other', 'a');
  expect(sortEventCount()).toBe(0);
  recordMetricVisit('prom', 'b');
  expect(sortEventCount()).toBe(1);
  window.dispatchEvent(new StorageEvent('storage', { key: matching }));
  expect(sortEventCount()).toBe(2);
  deactivate();
  window.dispatchEvent(new CustomEvent(PERSONAL_SIGNALS_CHANGED, { detail: matching }));
  expect(sortEventCount()).toBe(2);
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
