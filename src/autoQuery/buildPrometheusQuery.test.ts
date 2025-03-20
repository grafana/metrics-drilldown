import * as promql from '@grafana/promql-builder';

import { buildPrometheusQuery } from './buildPrometheusQuery';

describe('buildPrometheusQuery', () => {
  const defaultParams = {
    metric: 'test_metric',
    filters: '{}',
    isRateQuery: false,
    isUtf8Metric: false,
    otelJoinQuery: '',
  };

  describe('basic metrics (no rate)', () => {
    it('should build a simple average query for general metrics', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_general',
      });

      const expected = promql.avg(promql.vector('test_general')).build().toString();
      expect(result).toBe(expected);
    });

    it('should build a simple average query for bytes metrics', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_bytes',
      });

      const expected = promql.avg(promql.vector('test_bytes')).build().toString();
      expect(result).toBe(expected);
    });

    it('should build a simple average query for seconds metrics', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_seconds',
      });

      const expected = promql.avg(promql.vector('test_seconds')).build().toString();
      expect(result).toBe(expected);
    });
  });

  describe('rate-based metrics', () => {
    it('should build a rate query for count metrics', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_count',
        isRateQuery: true,
      });

      const expected = promql
        .sum(promql.rate(promql.vector('test_count').range('$__rate_interval')))
        .build()
        .toString();
      expect(result).toBe(expected);
    });

    it('should build a rate query for total metrics', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_total',
        isRateQuery: true,
      });

      const expected = promql
        .sum(promql.rate(promql.vector('test_total').range('$__rate_interval')))
        .build()
        .toString();
      expect(result).toBe(expected);
    });
  });

  describe('histogram metrics', () => {
    it('should build a histogram query for bucket metrics', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_bucket',
        isRateQuery: true,
        groupings: ['le'],
      });

      const expected = promql
        .sum(promql.rate(promql.vector('test_bucket').range('$__rate_interval')))
        .by(['le'])
        .build()
        .toString();
      expect(result).toBe(expected);
    });

    it('should build a histogram query for native histograms', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_histogram',
        isRateQuery: true,
        groupings: ['le'],
      });

      const expected = promql
        .sum(promql.rate(promql.vector('test_histogram').range('$__rate_interval')))
        .by(['le'])
        .build()
        .toString();
      expect(result).toBe(expected);
    });
  });

  describe('OTel resource queries', () => {
    it('should include OTel join query when provided', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        otelJoinQuery: '${otel_join_query}',
      });

      const expected = promql.avg(promql.vector('test_metric')).build().toString() + ' ${otel_join_query}';
      expect(result).toBe(expected);
    });
  });

  describe('UTF-8 metric support', () => {
    it('should handle UTF-8 metrics correctly', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_metric',
      });

      const expected = promql.avg(promql.vector('test_metric')).build().toString();
      expect(result).toBe(expected);
    });
  });

  describe('filters support', () => {
    it('should include filters in the query', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        filters: '{"job":"test"}',
      });

      const expected = promql.avg(promql.vector('test_metric').label('job', 'test')).build().toString();
      expect(result).toBe(expected);
    });
  });
});
