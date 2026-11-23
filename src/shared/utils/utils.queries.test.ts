import { buildFilterExpression, removeIgnoreUsageLabel, toExploreQuery } from './utils.queries';

describe('buildFilterExpression', () => {
  it('should build a standard label matcher', () => {
    expect(buildFilterExpression({ key: 'app', operator: '=', value: 'frontend' })).toBe('app="frontend"');
  });

  it('should produce an empty string matcher when value is empty string', () => {
    expect(buildFilterExpression({ key: 'evaluator', operator: '!=', value: '' })).toBe('evaluator!=""');
  });

  it('should produce an empty string matcher when value is double-quoted empty string', () => {
    expect(buildFilterExpression({ key: 'evaluator', operator: '!=', value: '""' })).toBe('evaluator!=""');
  });

  it('should handle regex operators', () => {
    expect(buildFilterExpression({ key: 'app', operator: '=~', value: '.*end' })).toBe('app=~".*end"');
  });

  it('should handle not-equal operator with a real value', () => {
    expect(buildFilterExpression({ key: 'env', operator: '!=', value: 'staging' })).toBe('env!="staging"');
  });

  it('should escape a literal double quote in the value instead of breaking out of the string literal', () => {
    expect(buildFilterExpression({ key: 'app', operator: '=', value: 'weird"value' })).toBe('app="weird\\"value"');
  });

  it('should escape a literal backslash in the value', () => {
    expect(buildFilterExpression({ key: 'app', operator: '=', value: 'back\\slash' })).toBe('app="back\\\\slash"');
  });

  it('should escape quotes without disturbing regex metacharacters in a regex operator value', () => {
    expect(buildFilterExpression({ key: 'app', operator: '=~', value: '^(a|"b")$' })).toBe('app=~"^(a|\\"b\\")$"');
  });

  it('should escape a literal newline in the value instead of emitting an invalid multi-line string literal', () => {
    expect(buildFilterExpression({ key: 'app', operator: '=', value: 'line1\nline2' })).toBe('app="line1\\nline2"');
  });

  it('should escape a literal tab in the value', () => {
    expect(buildFilterExpression({ key: 'app', operator: '=', value: 'a\tb' })).toBe('app="a\\tb"');
  });
});

describe('removeIgnoreUsageLabel', () => {
  it('should remove __ignore_usage__ label from middle of selector', () => {
    const input = 'go_goroutines{cluster="test", __ignore_usage__="", ${filters:raw}}';
    const expected = 'go_goroutines{cluster="test",  ${filters:raw}}';
    expect(removeIgnoreUsageLabel(input)).toBe(expected);
  });

  it('should handle multiple labels before __ignore_usage__', () => {
    const input = 'go_goroutines{cluster="test", instance!="us-east:5000", __ignore_usage__="", ${filters:raw}}';
    const expected = 'go_goroutines{cluster="test", instance!="us-east:5000",  ${filters:raw}}';
    expect(removeIgnoreUsageLabel(input)).toBe(expected);
  });

  it('should return query unchanged if __ignore_usage__ is not present', () => {
    const input = 'go_goroutines{cluster="test"}';
    expect(removeIgnoreUsageLabel(input)).toBe(input);
  });

  it('should return empty string unchanged', () => {
    expect(removeIgnoreUsageLabel('')).toBe('');
  });
});

describe('toExploreQuery', () => {
  it('drops the legend so Explore does not inherit the Drilldown one', () => {
    const query = { refId: 'A', expr: 'avg(metric)', legendFormat: 'avg', fromExploreMetrics: true };

    expect(toExploreQuery(query)).toEqual({ refId: 'A', expr: 'avg(metric)', fromExploreMetrics: true });
  });

  it('removes the __ignore_usage__ label from the expression', () => {
    const query = { refId: 'A', expr: 'avg(metric{__ignore_usage__="",job="api"})', legendFormat: '{{job}}' };

    expect(toExploreQuery(query)).toEqual({ refId: 'A', expr: 'avg(metric{job="api"})' });
  });

  it('leaves the panel query untouched', () => {
    const query = { refId: 'A', expr: 'avg(metric)', legendFormat: 'avg' };

    toExploreQuery(query);

    expect(query.legendFormat).toBe('avg');
  });

  it('handles queries without an expression', () => {
    expect(toExploreQuery({ refId: 'A', legendFormat: 'avg' })).toEqual({ refId: 'A' });
  });
});
