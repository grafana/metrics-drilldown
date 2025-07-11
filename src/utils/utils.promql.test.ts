import { extractMetricNames, parsePromQLQuery } from './utils.promql';

describe('utils.promql', () => {
  describe('extractMetricNames', () => {
    it('should extract metric names from basic query', () => {
      const result = extractMetricNames('http_requests_total');
      expect(result).toEqual(['http_requests_total']);
    });

    it('should extract metric names from query with labels', () => {
      const result = extractMetricNames('http_requests_total{method="GET"}');
      expect(result).toEqual(['http_requests_total']);
    });

    it('should extract multiple metric names from complex query', () => {
      const result = extractMetricNames('http_requests_total{status="200"} / http_requests_total');
      expect(result).toEqual(['http_requests_total']);
    });
  });

  describe('parsePromQLQuery', () => {
    it('should parse basic metric query', () => {
      const result = parsePromQLQuery('http_requests_total');
      expect(result.metricNames).toEqual(['http_requests_total']);
      expect(result.labelFilters).toEqual([]);
    });

    it('should parse query with single label', () => {
      const result = parsePromQLQuery('http_requests_total{method="GET"}');
      expect(result.metricNames).toEqual(['http_requests_total']);
      expect(result.labelFilters).toEqual([{ label: 'method', op: '=', value: 'GET' }]);
    });

    it('should parse query with multiple labels', () => {
      const result = parsePromQLQuery('http_requests_total{method="GET",status="200"}');
      expect(result.metricNames).toEqual(['http_requests_total']);
      expect(result.labelFilters).toEqual([
        { label: 'method', op: '=', value: 'GET' },
        { label: 'status', op: '=', value: '200' },
      ]);
    });

    it('should parse complex query with labels', () => {
      const result = parsePromQLQuery('100 * some_query{first_label="first", second_label="second"}');
      expect(result.metricNames).toEqual(['some_query']);
      expect(result.labelFilters).toEqual([
        { label: 'first_label', op: '=', value: 'first' },
        { label: 'second_label', op: '=', value: 'second' },
      ]);
    });

    it('should parse query with different operators', () => {
      const result = parsePromQLQuery('metric{label!="value",other=~"regex"}');
      expect(result.metricNames).toEqual(['metric']);
      expect(result.labelFilters).toEqual([
        { label: 'label', op: '!=', value: 'value' },
        { label: 'other', op: '=~', value: 'regex' },
      ]);
    });

    it('should handle escaped values in labels', () => {
      const result = parsePromQLQuery('metric{label="value\\"with\\"quotes"}');
      expect(result.metricNames).toEqual(['metric']);
      expect(result.labelFilters).toEqual([{ label: 'label', op: '=', value: 'value"with"quotes' }]);
    });
  });
});
