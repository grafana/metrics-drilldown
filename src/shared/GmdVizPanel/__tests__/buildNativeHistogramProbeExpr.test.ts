import { buildNativeHistogramProbeExpr } from '../buildNativeHistogramProbeExpr';

describe('buildNativeHistogramProbeExpr(metric, queryConfig)', () => {
  test('wraps the metric selector in sum(rate(...)) with the default rate interval', () => {
    const expr = buildNativeHistogramProbeExpr('my_metric', {
      labelMatchers: [],
      addIgnoreUsageFilter: true,
    });

    expect(expr).toContain('sum(');
    expect(expr).toContain('rate(');
    expect(expr).toContain('my_metric');
    expect(expr).toContain('$__rate_interval');
  });

  test('uses a custom rate interval when provided', () => {
    const expr = buildNativeHistogramProbeExpr('my_metric', {
      labelMatchers: [],
      addIgnoreUsageFilter: true,
      customRateInterval: '5m',
    });

    expect(expr).toContain('[5m]');
    expect(expr).not.toContain('$__rate_interval');
  });

  test('includes provided label matchers in the selector', () => {
    const expr = buildNativeHistogramProbeExpr('my_metric', {
      labelMatchers: [{ key: 'job', operator: '=', value: 'prometheus' }],
      addIgnoreUsageFilter: false,
    });

    expect(expr).toContain('job="prometheus"');
  });
});
