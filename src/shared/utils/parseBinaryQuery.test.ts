import { parseBinaryQuery } from './parseBinaryQuery';

describe('parseBinaryQuery', () => {
  it('parses a division of two bare selectors', () => {
    const ratio = parseBinaryQuery('errors_total{job="api"} / requests_total{job="api"}');
    expect(ratio).not.toBeNull();
    expect(ratio!.operator).toBe('/');
    expect(ratio!.left.preAggregated).toBe(false);
    expect(ratio!.left.leaves).toEqual([{ metricName: 'errors_total', labels: [{ label: 'job', op: '=', value: 'api' }] }]);
    expect(ratio!.right.leaves[0].metricName).toBe('requests_total');
  });

  it.each([
    ['a / b', '/'],
    ['a * b', '*'],
    ['a + b', '+'],
    ['a - b', '-'],
  ])('supports the operator in "%s"', (expr, operator) => {
    expect(parseBinaryQuery(expr)?.operator).toBe(operator);
  });

  it('flags pre-aggregated operands and still captures the inner leaf metrics', () => {
    const ratio = parseBinaryQuery('sum(rate(errors_total{job="api"}[5m])) / sum(rate(requests_total[5m]))');
    expect(ratio).not.toBeNull();
    expect(ratio!.left.preAggregated).toBe(true);
    expect(ratio!.left.leaves[0].metricName).toBe('errors_total');
    expect(ratio!.right.leaves[0].metricName).toBe('requests_total');
  });

  it('peels a scalar wrapper down to the inner binary', () => {
    const ratio = parseBinaryQuery('100 * (errors_total{} / requests_total{})');
    expect(ratio?.operator).toBe('/');
    expect(ratio?.left.leaves[0].metricName).toBe('errors_total');
    expect(ratio?.right.leaves[0].metricName).toBe('requests_total');
  });

  it('extracts colon recording-rule names', () => {
    const ratio = parseBinaryQuery('asserts:client:error:ratio{env="prod"} / asserts:client:total:ratio{env="prod"}');
    expect(ratio?.left.leaves[0].metricName).toBe('asserts:client:error:ratio');
    expect(ratio?.right.leaves[0].metricName).toBe('asserts:client:total:ratio');
  });

  it('collects multiple leaves on one side', () => {
    const ratio = parseBinaryQuery('(a{x="1"} * b{x="1"}) / c{x="1"}');
    expect(ratio?.left.leaves.map((l) => l.metricName)).toEqual(['a', 'b']);
    expect(ratio?.right.leaves.map((l) => l.metricName)).toEqual(['c']);
  });

  describe('returns null for non-binary / unsupported input', () => {
    it.each([
      ['a bare selector', 'asserts:x:ratio{app="y"}'],
      ['a scalar-scaled single metric', '100 * asserts:error:ratio'],
      ['a vector-matching modifier on()', 'a / on(job) b'],
      ['a vector-matching modifier ignoring()', 'a / ignoring(job) b'],
      ['a parse error', 'errors_total{'],
    ])('%s', (_label, expr) => {
      expect(parseBinaryQuery(expr)).toBeNull();
    });
  });
});
