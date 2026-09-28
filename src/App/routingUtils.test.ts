import { normalizeInternalPathname } from './routingUtils';

describe('normalizeInternalPathname', () => {
  it.each([
    ['//evil.example/path', '/evil.example/path'],
    ['\\\\evil.example\\path', '/evil.example/path'],
    ['///evil.example/path', '/evil.example/path'],
  ])('keeps protocol-relative input on an internal path (%s)', (pathname, expected) => {
    expect(normalizeInternalPathname(pathname)).toBe(expected);
  });

  it.each([
    ['/a/grafana-metricsdrilldown-app/drilldown', '/a/grafana-metricsdrilldown-app/drilldown'],
    ['a/grafana-metricsdrilldown-app/drilldown', '/a/grafana-metricsdrilldown-app/drilldown'],
  ])('returns a normal path with exactly one leading slash (%s)', (pathname, expected) => {
    expect(normalizeInternalPathname(pathname)).toBe(expected);
  });
});
