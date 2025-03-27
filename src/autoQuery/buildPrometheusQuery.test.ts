import * as promql from '@grafana/promql-builder';

import { buildPrometheusQuery } from './buildPrometheusQuery';

describe('buildPrometheusQuery', () => {
  const defaultParams = {
    metric: 'test_metric',
    filters: [],
    isRateQuery: false,
    isUtf8Metric: false,
    otelJoinQuery: '',
    ignoreUsage: false,
  };

  describe('basic metrics (no rate)', () => {
    it('should build a simple average query for general metrics', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_general',
      });

      const expected = promql.avg(promql.vector('test_general')).toString();
      expect(result).toBe(expected);
    });

    it('should build a simple average query for bytes metrics', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_bytes',
      });

      const expected = promql.avg(promql.vector('test_bytes')).toString();
      expect(result).toBe(expected);
    });

    it('should build a simple average query for seconds metrics', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_seconds',
      });

      const expected = promql.avg(promql.vector('test_seconds')).toString();
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

      const expected = promql.sum(promql.rate(promql.vector('test_count').range('$__rate_interval'))).toString();
      expect(result).toBe(expected);
    });

    it('should build a rate query for total metrics', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_total',
        isRateQuery: true,
      });

      const expected = promql.sum(promql.rate(promql.vector('test_total').range('$__rate_interval'))).toString();
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

      const expected = promql.avg(promql.vector('test_metric')).toString() + ' ${otel_join_query}';
      expect(result).toBe(expected);
    });
  });

  describe('UTF-8 metric support', () => {
    it('should handle UTF-8 metrics correctly', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'a.utf8.metric 🤘',
      });

      expect(result).toBe('avg({"a.utf8.metric 🤘"})');
    });

    it('should handle UTF-8 metrics with regular labels', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'a.utf8.metric 🤘',
        filters: [
          {
            key: 'job',
            value: 'test',
            operator: '=',
          },
        ],
      });

      expect(result).toBe('avg({"a.utf8.metric 🤘",job="test"})');
    });

    it('should handle UTF-8 metrics with UTF-8 labels', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'a.utf8.metric 🤘',
        filters: [
          {
            key: 'label with 📈',
            value: 'metrics',
            operator: '=',
          },
        ],
      });

      expect(result).toBe('avg({"a.utf8.metric 🤘","label with 📈"="metrics"})');
    });

    it('should handle UTF-8 metrics with rate query', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'a.utf8.metric 🤘',
        isRateQuery: true,
        filters: [
          {
            key: 'label with 📈',
            value: 'metrics',
            operator: '=',
          },
        ],
      });

      expect(result).toBe('sum(rate({"a.utf8.metric 🤘","label with 📈"="metrics"}[$__rate_interval]))');
    });

    it('should handle UTF-8 metrics with rate query and ignore usage', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'a.utf8.metric 🤘',
        isRateQuery: true,
        ignoreUsage: true,
        filters: [
          {
            key: 'label with 📈',
            value: 'metrics',
            operator: '=',
          },
        ],
      });

      expect(result).toBe(
        'sum(rate({"a.utf8.metric 🤘",__ignore_usage__="","label with 📈"="metrics"}[$__rate_interval]))'
      );
    });
  });

  describe('UTF-8 label support for regular metrics', () => {
    it('should handle regular metrics with UTF-8 labels', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_metric',
        filters: [
          {
            key: 'label with 📈',
            value: 'metrics',
            operator: '=',
          },
        ],
      });

      const expected = 'avg(test_metric{"label with 📈"="metrics"})';
      expect(result).toBe(expected);
    });

    it('should handle regular metrics with UTF-8 labels and different operators', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        metric: 'test_metric',
        filters: [
          {
            key: 'label with 📈',
            value: 'metrics',
            operator: '=',
          },
          {
            key: 'another label 🎯',
            value: 'value',
            operator: '=~',
          },
          {
            key: 'exclude label 🚫',
            value: 'bad',
            operator: '!=',
          },
        ],
      });

      const expected =
        'avg(test_metric{"label with 📈"="metrics","another label 🎯"=~"value","exclude label 🚫"!="bad"})';
      expect(result).toBe(expected);
    });
  });

  describe('filters support', () => {
    it('should include filters in the query', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        filters: [
          {
            key: 'job',
            value: 'test',
            operator: '=',
          },
        ],
      });

      const expected = 'avg(test_metric{job="test"})';
      expect(result).toBe(expected);
    });

    it('should handle multiple filters', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        filters: [
          {
            key: 'instance',
            value: 'host.docker.internal:3001',
            operator: '=',
          },
          {
            key: 'namespace',
            value: 'my-namespace',
            operator: '=',
          },
        ],
      });

      const expected = 'avg(test_metric{instance="host.docker.internal:3001",namespace="my-namespace"})';
      expect(result).toBe(expected);
    });

    it('should handle different filter operators', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        filters: [
          {
            key: 'job',
            value: 'test',
            operator: '=',
          },
          {
            key: 'env',
            value: 'prod',
            operator: '!=',
          },
          {
            key: 'service',
            value: 'web.*',
            operator: '=~',
          },
          {
            key: 'region',
            value: 'us-.*',
            operator: '!~',
          },
        ],
      });

      const expected = 'avg(test_metric{job="test",env!="prod",service=~"web.*",region!~"us-.*"})';
      expect(result).toBe(expected);
    });
  });

  describe('ignore usage filter', () => {
    it('should add __ignore_usage__ filter when ignoreUsage is true', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        ignoreUsage: true,
      });

      const expected = 'avg(test_metric{__ignore_usage__=""})';
      expect(result).toBe(expected);
    });

    it('should combine ignore usage with other filters', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        ignoreUsage: true,
        filters: [
          {
            key: 'instance',
            value: 'host.docker.internal:3001',
            operator: '=',
          },
        ],
      });

      const expected = 'avg(test_metric{__ignore_usage__="",instance="host.docker.internal:3001"})';
      expect(result).toBe(expected);
    });

    it('should combine ignore usage with UTF-8 labels', () => {
      const result = buildPrometheusQuery({
        ...defaultParams,
        ignoreUsage: true,
        filters: [
          {
            key: 'label with 📈',
            value: 'metrics',
            operator: '=',
          },
        ],
      });

      const expected = 'avg(test_metric{__ignore_usage__="","label with 📈"="metrics"})';
      expect(result).toBe(expected);
    });
  });
});
