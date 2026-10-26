import { type RankingProfile } from '../profile';
import {
  buildLocalBaseline,
  catalogRequest,
  mergeCatalogRanking,
  selectCatalogCandidates,
  type LocalSignals,
} from '../ranking';
import profileRequestFixture from './fixtures/catalog-profile-request.json';

const profile: RankingProfile = {
  schemaVersion: 1,
  name: 'Local name must not be forwarded',
  intent: 'Synthetic purchase health. https://example.invalid/private',
  rules: [
    { match: { prefix: 'checkout_' }, purpose: 'Synthetic customer purchases.', priority: 'high' },
    { match: { exact: 'checkout_debug' }, purpose: 'Only supporting detail.', priority: 'low' },
    { match: { prefix: 'unmatched_' }, purpose: 'Must remain local for this request.', priority: 'high' },
  ],
};
const empty = (): LocalSignals => ({
  trackedMetrics: new Map(),
  activeBurnMetrics: new Set(),
  attributedFiringCounts: new Map(),
  rankingProfile: profile,
});
const score = (high: number) => ({
  utility: high,
  probabilities: { high_value: high, supporting: 0, low_value: 1 - high, unknown: 0 },
});

it('matches the synthetic v2 wire fixture checked by the companion Go handler', () => {
  const fixtureProfile: RankingProfile = {
    schemaVersion: 1,
    name: 'Synthetic',
    intent: 'Prioritize the synthetic checkout service.',
    rules: [
      {
        match: { exact: 'http_server_request_duration_seconds_bucket' },
        purpose: 'Synthetic customer request duration.',
        priority: 'high',
      },
    ],
  };
  const baseline = buildLocalBaseline(
    profileRequestFixture.candidates.map((candidate) => candidate.name),
    empty(),
    (name) => profileRequestFixture.candidates.find((candidate) => candidate.name === name)
  );
  baseline[0].labelNames = ['http_request_method'];
  expect(
    JSON.parse(
      JSON.stringify(catalogRequest(baseline, 'synthetic-prom', { profile: fixtureProfile, shareWithJev: true }))
    )
  ).toEqual(profileRequestFixture);
});

it('applies bounded boosts/demotions, maintains incident/SLO bands and retains every matching metric', () => {
  const signals = empty();
  signals.activeBurnMetrics.add('checkout_debug');
  signals.trackedMetrics.set('tracked', new Set(['slo']));
  signals.personal = { historyBoosts: { checkout_custom: 0.1 }, bookmarks: ['checkout_custom'] };
  const baseline = buildLocalBaseline(
    ['ordinary', 'checkout_custom', 'checkout_debug', 'tracked'],
    signals,
    () => undefined
  );
  expect(baseline.map((candidate) => candidate.name)).toEqual([
    'checkout_debug',
    'tracked',
    'checkout_custom',
    'ordinary',
  ]);
  expect(baseline.find((candidate) => candidate.name === 'checkout_custom')?.localAdjustment).toBeCloseTo(0.2);
  expect(baseline[0].localAdjustment).toBeCloseTo(-0.1);
  const request = catalogRequest(baseline, 'prom');
  const scores = Object.fromEntries(request.candidates.map((candidate) => [candidate.id, score(0.7)]));
  expect(mergeCatalogRanking(baseline, request, scores)).toEqual(baseline.map((candidate) => candidate.name));
  expect(mergeCatalogRanking(baseline, request, {})).toHaveLength(4);
});

it('never includes semantic notes without explicit stored consent; only matched purposes are sent', () => {
  const baseline = buildLocalBaseline(['checkout_custom', 'checkout_debug', 'ordinary'], empty(), () => undefined);
  const local = catalogRequest(baseline, 'prom', { profile, shareWithJev: false });
  expect(local.schemaVersion).toBe(1);
  expect(local).not.toHaveProperty('profile');
  expect(local.candidates.every((candidate) => !('purpose' in candidate))).toBe(true);
  const semantic = catalogRequest(baseline, 'prom', { profile, shareWithJev: true });
  expect(semantic.schemaVersion).toBe(2);
  expect(semantic.profile?.intent).toBe('Synthetic purchase health. [link omitted]');
  expect(semantic.candidates.find((candidate) => candidate.name === 'checkout_custom')?.purpose).toBe(
    'Synthetic customer purchases.'
  );
  expect(semantic.candidates.find((candidate) => candidate.name === 'checkout_debug')?.purpose).toBe(
    'Only supporting detail.'
  );
  expect(semantic.candidates.find((candidate) => candidate.name === 'ordinary')).not.toHaveProperty('purpose');
  const wire = JSON.stringify(semantic);
  for (const localField of [
    'shareWithJev',
    'rules',
    'priority',
    'Local name',
    'Must remain local',
    'historyBoosts',
    'profileBoost',
    'localAdjustment',
  ]) {
    expect(wire).not.toContain(localField);
  }
});

it('keeps empty semantic requests on v1 and supports matched-purpose-only v2 profiles', () => {
  const baseline = buildLocalBaseline(['ordinary'], empty(), () => undefined);
  const purposeOnly = { ...profile, intent: '' };
  expect(catalogRequest(baseline, 'prom', { profile: purposeOnly, shareWithJev: true }).schemaVersion).toBe(1);
  const matched = buildLocalBaseline(['checkout_custom'], empty(), () => undefined);
  expect(catalogRequest(matched, 'prom', { profile: purposeOnly, shareWithJev: true }).schemaVersion).toBe(2);
});

it('reserves bounded candidate exposure for unfamiliar preferred instruments without increasing request size', () => {
  const names = [...Array.from({ length: 30000 }, (_, i) => `service_${i}_errors_total`), 'checkout_custom'];
  const signals = empty();
  signals.activeBurnMetrics.add(names[0]);
  signals.trackedMetrics.set(names[1], new Set(['slo']));
  const baseline = buildLocalBaseline(names, signals, () => undefined);
  const selected = selectCatalogCandidates(baseline);
  expect(selected).toHaveLength(40);
  expect(selected.some((candidate) => candidate.name === 'checkout_custom')).toBe(true);
  expect(selected.slice(0, 2).map((candidate) => candidate.name)).toEqual(names.slice(0, 2));
  expect(baseline).toHaveLength(names.length);
});
