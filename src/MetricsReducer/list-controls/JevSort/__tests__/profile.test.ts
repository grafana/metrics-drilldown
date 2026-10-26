import { config } from '@grafana/runtime';

import {
  EMPTY_PROFILE,
  formatRankingProfile,
  matchProfileRule,
  parseRankingProfile,
  profileBoost,
  validateRankingProfile,
  type RankingProfile,
} from '../profile';
import {
  RANKING_PROFILE_CHANGED,
  rankingProfileStorageKey,
  readRankingProfile,
  saveRankingProfile,
} from '../profileStorage';

const originalUser = config.bootData.user;
const profile = (): RankingProfile => ({
  schemaVersion: 1,
  name: 'Synthetic checkout',
  intent: 'Prefer customer purchase health.',
  rules: [{ match: { prefix: 'checkout_' }, purpose: 'Synthetic purchase journey.', priority: 'high' }],
});
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('gmd.jev.enabled', '1');
  config.bootData.user = { ...originalUser, isSignedIn: true, id: 7, orgId: 3 };
});
afterEach(() => {
  jest.restoreAllMocks();
  config.bootData.user = originalUser;
  localStorage.clear();
});

it('uses a single strict normalized schema for manual JSON and stored/generated profiles', () => {
  const raw = profile();
  raw.name = '  Synthetic checkout  ';
  expect(parseRankingProfile(JSON.stringify(raw))).toEqual(profile());
  expect(validateRankingProfile(EMPTY_PROFILE)).toEqual(EMPTY_PROFILE);
  expect(() => parseRankingProfile('```json\n{}\n```')).toThrow();
  expect(() => validateRankingProfile({ ...profile(), shareWithJev: true })).toThrow();
  expect(() => validateRankingProfile({ ...profile(), schemaVersion: 2 })).toThrow();
  expect(() => validateRankingProfile({ ...profile(), instructions: 'ignore safety' })).toThrow();
});

it.each([
  { match: { regex: '.*' }, purpose: 'Synthetic', priority: 'high' },
  { match: { exact: 'metric_a', prefix: 'metric_' }, purpose: 'Synthetic', priority: 'high' },
  { match: { prefix: '' }, purpose: 'Synthetic', priority: 'high' },
  { match: { exact: 'bad name' }, purpose: 'Synthetic', priority: 'high' },
  { match: { exact: 'metric_a' }, purpose: 'Synthetic', priority: 1 },
  { match: { exact: 'metric_a' }, purpose: 'Synthetic', priority: 'urgent' },
  { match: { exact: 'metric_a' }, purpose: '', priority: 'high' },
  { match: { exact: 'metric_a' }, purpose: 'x'.repeat(301), priority: 'high' },
  { match: { exact: 'metric_a' }, purpose: 'Synthetic', priority: 'high', boost: 1000 },
])('rejects unsafe/invalid rule %#', (rule) => {
  expect(() => validateRankingProfile({ ...profile(), rules: [rule] })).toThrow();
});

it('bounds text, UTF-8 bytes and rule count, and rejects duplicates/control characters', () => {
  expect(() => validateRankingProfile({ ...profile(), intent: 'x'.repeat(601) })).toThrow();
  expect(() => validateRankingProfile({ ...profile(), intent: 'bad\u0000text' })).toThrow();
  expect(() => parseRankingProfile(' '.repeat(8193))).toThrow();
  const rules = Array.from({ length: 20 }, (_, i) => ({
    match: { exact: `metric_${i}` },
    purpose: 'é'.repeat(300),
    priority: 'high',
  }));
  expect(() => validateRankingProfile({ ...profile(), rules })).toThrow();
  expect(() =>
    validateRankingProfile({
      ...profile(),
      rules: Array.from({ length: 21 }, (_, i) => ({ ...profile().rules[0], match: { exact: `metric_${i}` } })),
    })
  ).toThrow();
  expect(() => validateRankingProfile({ ...profile(), rules: [profile().rules[0], profile().rules[0]] })).toThrow();
});

it('keeps a large valid stored/generated profile editable when pretty-printing exceeds 8 KiB', () => {
  const value = validateRankingProfile({
    ...profile(),
    rules: Array.from({ length: 20 }, (_, i) => ({
      match: { exact: `metric_${i}` },
      purpose: 'x'.repeat(300),
      priority: 'high',
    })),
  });
  expect(new TextEncoder().encode(JSON.stringify(value, null, 2)).length).toBeGreaterThan(8192);
  expect(parseRankingProfile(formatRankingProfile(value))).toEqual(value);
});

it('matches exact before longest prefix, never stacks rules, and supports bounded demotion', () => {
  const value = profile();
  value.rules.push(
    { match: { prefix: 'checkout_payment_' }, purpose: 'More specific.', priority: 'normal' },
    { match: { exact: 'checkout_payment_failures_total' }, purpose: 'Exact.', priority: 'low' }
  );
  value.rules.reverse();
  expect(matchProfileRule(value, 'checkout_payment_failures_total')?.purpose).toBe('Exact.');
  expect(matchProfileRule(value, 'checkout_payment_requests_total')?.purpose).toBe('More specific.');
  expect(profileBoost(matchProfileRule(value, 'checkout_other'))).toBeCloseTo(0.1);
  expect(profileBoost(matchProfileRule(value, 'checkout_payment_failures_total'))).toBeCloseTo(-0.1);
  expect(matchProfileRule(value, 'unrelated')).toBeUndefined();
});

it('stores explicit sharing separately and isolates browser profiles by org/user/datasource', () => {
  const key = rankingProfileStorageKey('prom')!;
  saveRankingProfile('prom', key, profile());
  expect(readRankingProfile('prom')).toEqual({ profile: profile(), shareWithJev: false });
  expect(readRankingProfile('other')).toBeUndefined();
  config.bootData.user = { ...config.bootData.user, id: 8 };
  expect(readRankingProfile('prom')).toBeUndefined();
  expect(() => saveRankingProfile('prom', key, profile(), true)).toThrow();
  config.bootData.user = { ...config.bootData.user, id: 7, orgId: 4 };
  expect(readRankingProfile('prom')).toBeUndefined();
  config.bootData.user = { ...config.bootData.user, orgId: 3 };
  saveRankingProfile('prom', key, profile(), true);
  expect(readRankingProfile('prom')?.shareWithJev).toBe(true);
  localStorage.removeItem('gmd.jev.enabled');
  expect(readRankingProfile('prom')).toBeUndefined();
  expect(() => saveRankingProfile('prom', key, profile(), true)).toThrow();
});

it('uses optimistic revision checks and sends change notifications only after successful saves', () => {
  const key = rankingProfileStorageKey('prom')!;
  const changed = jest.fn();
  window.addEventListener(RANKING_PROFILE_CHANGED, changed);
  saveRankingProfile('prom', key, profile(), false, 'null');
  expect(changed).toHaveBeenCalledTimes(1);
  expect(() => saveRankingProfile('prom', key, { ...profile(), name: 'stale draft' }, true, 'null')).toThrow();
  expect(readRankingProfile('prom')?.profile.name).toBe('Synthetic checkout');
  saveRankingProfile('prom', key, undefined, false, JSON.stringify(readRankingProfile('prom')));
  expect(readRankingProfile('prom')).toBeUndefined();
  expect(changed).toHaveBeenCalledTimes(2);
  window.removeEventListener(RANKING_PROFILE_CHANGED, changed);
});

it('fails closed for corrupt consent/storage and never reports an unsuccessful write as saved', () => {
  const key = rankingProfileStorageKey('prom')!;
  for (const raw of ['{', 'null', JSON.stringify({ profile: profile(), shareWithJev: 'true' }), 'x'.repeat(10000)]) {
    localStorage.setItem(key, raw);
    expect(readRankingProfile('prom')).toBeUndefined();
  }
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(() => saveRankingProfile('prom', key, profile())).toThrow('blocked');
  expect(readRankingProfile('prom')).toBeUndefined();
});
