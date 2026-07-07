import { injectLabelMatcher } from './injectLabelMatcher';

describe('injectLabelMatcher', () => {
  it('adds a matcher to a selector that already has braces', () => {
    expect(injectLabelMatcher('errors_total{job="api"}', 'path', '/foo')).toBe('errors_total{job="api", path="/foo"}');
  });

  it('adds a brace block to a bare selector', () => {
    expect(injectLabelMatcher('errors_total', 'path', '/foo')).toBe('errors_total{path="/foo"}');
  });

  it('injects into empty braces without a leading comma', () => {
    expect(injectLabelMatcher('errors_total{}', 'path', '/foo')).toBe('errors_total{path="/foo"}');
  });

  it('replaces an existing matcher for the same label rather than appending a contradiction', () => {
    expect(injectLabelMatcher('errors_total{path="/old"}', 'path', '/new')).toBe('errors_total{path="/new"}');
  });

  it('injects into both operands of a binary', () => {
    expect(injectLabelMatcher('errors_total{job="api"} / requests_total', 'env', 'prod')).toBe(
      'errors_total{job="api", env="prod"} / requests_total{env="prod"}'
    );
  });

  it('injects into the inner selector of a pre-aggregated operand', () => {
    expect(injectLabelMatcher('sum(rate(errors_total{job="api"}[5m]))', 'env', 'prod')).toBe(
      'sum(rate(errors_total{job="api", env="prod"}[5m]))'
    );
  });

  it('handles colon recording-rule names', () => {
    expect(injectLabelMatcher('asserts:client:error:ratio{app="x"}', 'env', 'prod')).toBe(
      'asserts:client:error:ratio{app="x", env="prod"}'
    );
  });

  it('escapes quotes in the value', () => {
    expect(injectLabelMatcher('m', 'k', 'a"b')).toBe('m{k="a\\"b"}');
  });

  it('returns the input unchanged on a parse error', () => {
    expect(injectLabelMatcher('errors_total{', 'path', '/foo')).toBe('errors_total{');
  });
});
