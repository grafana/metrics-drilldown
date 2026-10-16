import { config } from '@grafana/runtime';

import { PREF_KEYS } from 'shared/user-preferences/pref-keys';
import { userStorage } from 'shared/user-preferences/userStorage';

import {
  getPersonalSignals,
  MAX_HISTORY_BOOST,
  PERSONAL_SIGNALS_CHANGED,
  personalStorageKey,
  recordMetricBookmark,
  recordMetricVisit,
} from '../personalization';

const originalUser = config.bootData.user;
const day = 24 * 60 * 60 * 1000;

function saveBookmark(name: string, datasourceUid = 'prom', createdAt = Date.now()) {
  const bookmark = {
    createdAt,
    urlValues: { metric: name, 'var-ds': datasourceUid, 'var-filters': ['private=value'] },
  };
  const existing = userStorage.getItem(PREF_KEYS.BOOKMARKS) || [];
  userStorage.setItem(PREF_KEYS.BOOKMARKS, [...existing, bookmark]);
  recordMetricBookmark(datasourceUid, name, createdAt, true);
  return bookmark;
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
  localStorage.clear();
  localStorage.setItem('gmd.jev.enabled', '1');
  config.bootData.user = { ...originalUser, isSignedIn: true, id: 7, orgId: 3 };
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  config.bootData.user = originalUser;
  localStorage.clear();
});

it('starts clean without importing legacy recents or bookmarks', () => {
  userStorage.setItem(PREF_KEYS.RECENT_METRICS, [{ name: 'legacy_metric', timestamp: Date.now() }]);
  userStorage.setItem(PREF_KEYS.BOOKMARKS, [
    { createdAt: Date.now(), urlValues: { metric: 'legacy_metric', 'var-ds': 'prom' } },
  ]);
  expect(getPersonalSignals('prom')).toEqual({ historyBoosts: {}, bookmarks: [] });
  expect(localStorage.getItem(personalStorageKey('prom')!)).toBeNull();
});

it('isolates by datasource, user, and organization, without guessing anonymous identity', () => {
  recordMetricVisit('prom', 'metric_a');
  saveBookmark('metric_a');
  expect(getPersonalSignals('prom').bookmarks).toEqual(['metric_a']);
  expect(getPersonalSignals('other')).toEqual({ historyBoosts: {}, bookmarks: [] });
  config.bootData.user = { ...config.bootData.user, id: 8 };
  expect(getPersonalSignals('prom')).toEqual({ historyBoosts: {}, bookmarks: [] });
  config.bootData.user = { ...config.bootData.user, id: 7, orgId: 4 };
  expect(getPersonalSignals('prom')).toEqual({ historyBoosts: {}, bookmarks: [] });
  config.bootData.user = { ...config.bootData.user, orgId: 3 };
  expect(getPersonalSignals('prom').historyBoosts.metric_a).toBeGreaterThan(0);
  config.bootData.user = { ...config.bootData.user, isSignedIn: false };
  expect(personalStorageKey('prom')).toBeUndefined();
  recordMetricVisit('prom', 'anonymous_metric');
  expect(getPersonalSignals('prom')).toEqual({ historyBoosts: {}, bookmarks: [] });
});

it('increases with intentional repeat visits, deduplicates rapid events, caps and decays', () => {
  recordMetricVisit('prom', 'metric_a');
  const first = getPersonalSignals('prom').historyBoosts.metric_a;
  recordMetricVisit('prom', 'metric_a');
  expect(getPersonalSignals('prom').historyBoosts.metric_a).toBe(first);
  for (let i = 0; i < 10; i++) {
    jest.advanceTimersByTime(60_000);
    recordMetricVisit('prom', 'metric_a');
  }
  const repeated = getPersonalSignals('prom').historyBoosts.metric_a;
  expect(repeated).toBeGreaterThan(first);
  expect(repeated).toBeLessThanOrEqual(MAX_HISTORY_BOOST);
  jest.advanceTimersByTime(7 * day);
  expect(getPersonalSignals('prom').historyBoosts.metric_a).toBeCloseTo(repeated / 2);
  jest.advanceTimersByTime(23 * day);
  expect(getPersonalSignals('prom').historyBoosts).toEqual({});
});

it('bounds retained history and bookmarks to 50 each and preserves newest entries', () => {
  for (let i = 0; i < 60; i++) {
    jest.advanceTimersByTime(1);
    recordMetricVisit('prom', `metric_${i}`);
    saveBookmark(`metric_${i}`);
  }
  const signals = getPersonalSignals('prom');
  expect(Object.keys(signals.historyBoosts)).toHaveLength(50);
  expect(signals.bookmarks).toHaveLength(50);
  expect(signals.historyBoosts.metric_0).toBeUndefined();
  expect(signals.historyBoosts.metric_59).toBeGreaterThan(0);
  const stored = localStorage.getItem(personalStorageKey('prom')!)!;
  expect(stored).not.toContain('private');
  expect(stored).not.toContain('var-filters');
});

it('retains a metric boost until its last attributed bookmark is removed', () => {
  const first = saveBookmark('metric_a');
  jest.advanceTimersByTime(1);
  const second = saveBookmark('metric_a');
  recordMetricBookmark('prom', 'metric_a', first.createdAt, false);
  expect(getPersonalSignals('prom').bookmarks).toEqual(['metric_a']);
  recordMetricBookmark('prom', 'metric_a', second.createdAt, false);
  expect(getPersonalSignals('prom').bookmarks).toEqual([]);
});

it('does not resurrect bookmarks deleted while the experiment was disabled', () => {
  saveBookmark('metric_a');
  localStorage.removeItem('gmd.jev.enabled');
  userStorage.setItem(PREF_KEYS.BOOKMARKS, []);
  recordMetricBookmark('prom', 'metric_a', Date.now(), false);
  localStorage.setItem('gmd.jev.enabled', '1');
  expect(getPersonalSignals('prom').bookmarks).toEqual([]);
});

it('skips reads/writes while disabled and never changes legacy storage', () => {
  localStorage.removeItem('gmd.jev.enabled');
  const before = localStorage.length;
  recordMetricVisit('prom', 'metric_a');
  recordMetricBookmark('prom', 'metric_a', Date.now(), true);
  expect(getPersonalSignals('prom')).toEqual({ historyBoosts: {}, bookmarks: [] });
  expect(localStorage).toHaveLength(before);
  expect(personalStorageKey('')).toBeUndefined();
  localStorage.setItem('gmd.jev.enabled', '1');
  expect(personalStorageKey('$ds')).toBeUndefined();
  expect(personalStorageKey('')).toBeUndefined();
});

it('fails open for corrupt/oversized records, blocked storage, invalid values and future dates', () => {
  const key = personalStorageKey('prom')!;
  for (const bad of ['{', 'null', JSON.stringify({ visits: {} }), 'x'.repeat(65537)]) {
    localStorage.setItem(key, bad);
    expect(getPersonalSignals('prom')).toEqual({ historyBoosts: {}, bookmarks: [] });
  }
  localStorage.setItem(
    key,
    JSON.stringify({
      visits: [
        { name: 'future_metric', viewedAt: Date.now() + 1, weight: 1 },
        { name: 'expired_metric', viewedAt: Date.now() - 31 * day, weight: 1 },
        { name: 'invalid_weight', viewedAt: Date.now(), weight: -1 },
        { name: 'too_many', viewedAt: Date.now(), weight: 6 },
        { name: 'bad name', viewedAt: Date.now(), weight: 1 },
        { name: 'valid_metric', viewedAt: Date.now(), weight: 1 },
      ],
    })
  );
  expect(Object.keys(getPersonalSignals('prom').historyBoosts)).toEqual(['valid_metric']);
  const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(() => recordMetricVisit('prom', 'metric_a')).not.toThrow();
  expect(getPersonalSignals('prom')).toEqual({ historyBoosts: {}, bookmarks: [] });
  get.mockRestore();
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('full');
  });
  expect(() => recordMetricVisit('prom', 'metric_a')).not.toThrow();
});

it('notifies same-tab rankers only after a successful scoped write', () => {
  const changed = jest.fn();
  window.addEventListener(PERSONAL_SIGNALS_CHANGED, changed);
  recordMetricVisit('prom', 'metric_a');
  expect(changed).toHaveBeenCalledTimes(1);
  expect(changed.mock.calls[0][0].detail).toBe(personalStorageKey('prom'));
  recordMetricVisit('prom', 'metric_a');
  expect(changed).toHaveBeenCalledTimes(1);
  window.removeEventListener(PERSONAL_SIGNALS_CHANGED, changed);
});
