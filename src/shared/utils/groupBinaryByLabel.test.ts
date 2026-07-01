import { groupBinaryByLabel } from './groupBinaryByLabel';

describe('groupBinaryByLabel', () => {
  it('injects by(label) into each pre-aggregated operand instead of wrapping the binary', () => {
    expect(groupBinaryByLabel('sum(rate(a[5m]))/sum(rate(b[5m]))', 'env')).toBe(
      'sum by (env)(rate(a[5m])) / sum by (env)(rate(b[5m]))'
    );
  });

  it('replaces an existing by()/without() modifier on an operand', () => {
    expect(groupBinaryByLabel('sum by(x)(rate(a[5m])) / c', 'env')).toBe(
      'sum by (env)(rate(a[5m])) / sum by (env) (c)'
    );
  });

  it('wraps bare operands in sum by(label)(...)', () => {
    expect(groupBinaryByLabel('a{job="api"} / b{job="api"}', 'env')).toBe(
      'sum by (env) (a{job="api"}) / sum by (env) (b{job="api"})'
    );
  });

  it('preserves the binary operator', () => {
    expect(groupBinaryByLabel('sum(rate(a[5m])) - sum(rate(b[5m]))', 'env')).toBe(
      'sum by (env)(rate(a[5m])) - sum by (env)(rate(b[5m]))'
    );
  });

  it("preserves each operand's aggregation operator (avg stays avg, not hardcoded sum)", () => {
    expect(groupBinaryByLabel('avg(rate(a[5m]))/avg(rate(b[5m]))', 'env')).toBe(
      'avg by (env)(rate(a[5m])) / avg by (env)(rate(b[5m]))'
    );
  });

  it('returns null for a non-binary query', () => {
    expect(groupBinaryByLabel('asserts:x:ratio{app="y"}', 'env')).toBeNull();
  });
});
