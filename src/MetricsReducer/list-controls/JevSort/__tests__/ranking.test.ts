import {
  buildLocalBaseline,
  catalogRequest,
  mergeCatalogRanking,
  metricFamily,
  otelEvidence,
  selectCatalogCandidates,
  validateCatalogScore,
  type LocalSignals,
} from '../ranking';

const empty = (): LocalSignals => ({
  trackedMetrics: new Map(),
  activeBurnMetrics: new Set(),
  attributedFiringCounts: new Map(),
});
const score = (high: number) => ({
  utility: 99,
  probabilities: { high_value: high, supporting: 0, low_value: 1 - high, unknown: 0 },
});

describe('catalog ranking policy', () => {
  it('guarantees all incident and SLO bands, including unscored metrics', () => {
    const signals = empty();
    signals.trackedMetrics.set('healthy', new Set(['synthetic-slo']));
    signals.activeBurnMetrics.add('burn');
    signals.attributedFiringCounts.set('firing', 1);
    const baseline = buildLocalBaseline(['ordinary', 'healthy', 'firing', 'burn'], signals, () => undefined);
    const request = catalogRequest(selectCatalogCandidates(baseline), 'prom');
    const ordinary = request.candidates.find((c) => c.name === 'ordinary')!;
    const ranked = mergeCatalogRanking(baseline, request, { [ordinary.id]: score(1) });
    expect(ranked).toEqual(['burn', 'firing', 'healthy', 'ordinary']);
  });

  it('reorders inside bands, preserves ties and never trusts the utility field', () => {
    const baseline = buildLocalBaseline(['a', 'b', 'c', 'd'], empty(), () => undefined);
    const request = catalogRequest(baseline, 'prom');
    expect(mergeCatalogRanking(baseline, request, { c02: score(0.8), c03: score(0.8), foreign: score(1) })).toEqual([
      'b',
      'c',
      'a',
      'd',
    ]);
    expect(validateCatalogScore(score(0.8))?.utility).toBeCloseTo(0.8);
  });

  it('handles 30k names and more than 40 incidents with bounded requests, no loss', () => {
    const names = Array.from({ length: 30000 }, (_, i) => `metric_${i}`);
    const signals = empty();
    names.slice(0, 65).forEach((name) => signals.attributedFiringCounts.set(name, 1));
    names.slice(65, 100).forEach((name) => signals.trackedMetrics.set(name, new Set(['slo'])));
    const baseline = buildLocalBaseline(names, signals, () => undefined);
    const selected = selectCatalogCandidates(baseline);
    expect(selected).toHaveLength(40);
    expect([0, 1, 2].map((band) => selected.filter((c) => c.band === band).length)).toEqual([20, 12, 8]);
    expect(mergeCatalogRanking(baseline, catalogRequest(selected, 'prom'), {}).slice(0, 65)).toEqual(
      names.slice(0, 65)
    );
    expect(new Set(baseline.map((c) => c.name)).size).toBe(30000);
  });

  it('refills unused quotas and diversifies histogram families', () => {
    const baseline = buildLocalBaseline(
      ['request_seconds_bucket', 'request_seconds_count', 'request_seconds_sum', 'other', 'another', 'über'],
      empty(),
      () => undefined
    );
    const selected = selectCatalogCandidates(baseline);
    expect(selected).toHaveLength(5);
    expect(baseline.some((c) => c.name === 'über')).toBe(true);
    expect(metricFamily('request_seconds_count')).toBe(metricFamily('request_seconds_bucket'));
    const large = buildLocalBaseline(
      [
        ...Array.from({ length: 50 }, (_, i) => `scope${i}:request_seconds:rate`),
        ...Array.from({ length: 50 }, (_, i) => `independent_${i}`),
      ],
      empty(),
      () => undefined
    );
    expect(selectCatalogCandidates(large).filter((c) => c.name.startsWith('independent_')).length).toBeGreaterThan(30);
  });

  it('uses conservative OTel evidence and keeps non-OTel health metrics eligible', () => {
    expect(otelEvidence('http_server_request_duration_seconds_bucket')).toBe('semantic-convention');
    expect(otelEvidence('custom', ['service_name', 'job'])).toBe('unknown');
    expect(otelEvidence('custom', ['otel_scope_name'])).toBe('scope-labels');
    expect(otelEvidence('http_custom')).toBe('unknown');
    expect(buildLocalBaseline(['service_build_info', 'custom_errors_total'], empty(), () => undefined)[0].name).toBe(
      'custom_errors_total'
    );
  });

  it('keeps documentation URLs out of catalog metadata without changing Related helpers', () => {
    const baseline = buildLocalBaseline(['synthetic_errors_total'], empty(), () => ({
      help: 'Error counter. See https://example.invalid/private?tenant=synthetic',
      unit: 'https://example.invalid',
    }));
    const request = catalogRequest(baseline, 'synthetic-prom');
    expect(request.candidates[0].help).toBe('Error counter. See [link omitted]');
    expect(request.candidates[0].unit).toBeUndefined();
    expect(baseline[0].help).toContain('https://');
  });

  it.each([NaN, Infinity, -0.1, 1.1])('rejects invalid probability %s', (n) => {
    expect(validateCatalogScore(score(n))).toBeUndefined();
  });
  it('rejects unknown, missing, unnormalized and flat distributions', () => {
    expect(validateCatalogScore({ probabilities: { unknown: 1 } })).toBeUndefined();
    expect(
      validateCatalogScore({ probabilities: { high_value: 0.9, supporting: 0.9, low_value: 0, unknown: 0 } })
    ).toBeUndefined();
    expect(
      validateCatalogScore({ probabilities: { high_value: 0.25, supporting: 0.25, low_value: 0.25, unknown: 0.25 } })
    ).toBeUndefined();
    expect(selectCatalogCandidates([])).toEqual([]);
  });
});
