import { buildFilterExpression, removeIgnoreUsageLabel } from './utils.queries';

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

