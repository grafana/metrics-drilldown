import { type PrometheusFunction } from 'shared/GmdVizPanel/config/promql-functions';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { logger } from 'shared/logger/logger';

import { getTimeseriesQueryRunnerParams } from '../getTimeseriesQueryRunnerParams';

describe('getTimeseriesQueryRunnerParams(options)', () => {
  test('skips unknown PromQL function and logs a warning', () => {
    const result = getTimeseriesQueryRunnerParams({
      metric: { name: 'go_goroutines', type: 'gauge' },
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [],
        addIgnoreUsageFilter: false,
        queries: [{ fn: 'unknown_fn' as PrometheusFunction }],
      },
    });

    expect(result.queries).toStrictEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      '[getTimeseriesQueryRunnerParams] Unknown PromQL function "unknown_fn", skipping query.'
    );
  });

  describe('without group by label', () => {
    test('handles gauge metrics', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'go_goroutines', type: 'gauge' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.HIGH,
          labelMatchers: [{ key: 'instance', operator: '=', value: 'us-east:5000' }],
          addIgnoreUsageFilter: true,
        },
      });

      expect(result.isRateQuery).toBe(false);
      expect(result.maxDataPoints).toBe(500);
      expect(result.queries).toStrictEqual([
        {
          refId: 'go_goroutines-avg',
          expr: 'avg(go_goroutines{instance="us-east:5000", __ignore_usage__="", ${filters:raw}})',
          legendFormat: 'avg',
          fromExploreMetrics: true,
        },
      ]);
    });

    test('handles counter metrics', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'go_gc_heap_frees_bytes_total', type: 'counter' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.MEDIUM,
          labelMatchers: [{ key: 'job', operator: '!=', value: 'prometheus' }],
          addIgnoreUsageFilter: true,
        },
      });

      expect(result.isRateQuery).toBe(true);
      expect(result.maxDataPoints).toBe(250);
      expect(result.queries).toStrictEqual([
        {
          refId: 'go_gc_heap_frees_bytes_total-sum(rate)',
          expr: 'sum(rate(go_gc_heap_frees_bytes_total{job!="prometheus", __ignore_usage__="", ${filters:raw}}[$__rate_interval]))',
          legendFormat: 'sum(rate)',
          fromExploreMetrics: true,
        },
      ]);
    });

    test('applies customRateInterval override to counter rate window', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'go_gc_heap_frees_bytes_total', type: 'counter' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.MEDIUM,
          labelMatchers: [{ key: 'job', operator: '!=', value: 'prometheus' }],
          addIgnoreUsageFilter: true,
          customRateInterval: '5m',
        },
      });

      expect(result.queries).toStrictEqual([
        {
          refId: 'go_gc_heap_frees_bytes_total-sum(rate)',
          expr: 'sum(rate(go_gc_heap_frees_bytes_total{job!="prometheus", __ignore_usage__="", ${filters:raw}}[5m]))',
          legendFormat: 'sum(rate)',
          fromExploreMetrics: true,
        },
      ]);
    });

    test('ignores customRateInterval for gauge metrics (no rate wrap)', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'go_goroutines', type: 'gauge' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.MEDIUM,
          labelMatchers: [],
          addIgnoreUsageFilter: true,
          customRateInterval: '5m',
        },
      });

      expect(result.queries[0].expr).toBe('avg(go_goroutines{__ignore_usage__="", ${filters:raw}})');
    });

    test('applies customFunction=max_over_time on a gauge with default interval', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'desired_shards', type: 'gauge' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.MEDIUM,
          labelMatchers: [],
          addIgnoreUsageFilter: true,
          customFunction: 'max_over_time',
        },
      });

      expect(result.queries).toStrictEqual([
        {
          refId: 'desired_shards-max_over_time',
          expr: 'max_over_time(desired_shards{__ignore_usage__="", ${filters:raw}}[$__rate_interval])',
          legendFormat: 'max_over_time',
          fromExploreMetrics: true,
        },
      ]);
    });

    test('applies customFunction=max_over_time with customRateInterval override', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'desired_shards', type: 'gauge' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.MEDIUM,
          labelMatchers: [],
          addIgnoreUsageFilter: true,
          customFunction: 'max_over_time',
          customRateInterval: '5m',
        },
      });

      expect(result.queries[0].expr).toBe(
        'max_over_time(desired_shards{__ignore_usage__="", ${filters:raw}}[5m])'
      );
    });

    test('counter with customFunction=avg still wraps in rate', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'http_requests_total', type: 'counter' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.MEDIUM,
          labelMatchers: [],
          addIgnoreUsageFilter: true,
          customFunction: 'avg',
        },
      });

      expect(result.queries).toStrictEqual([
        {
          refId: 'http_requests_total-avg(rate)',
          expr: 'avg(rate(http_requests_total{__ignore_usage__="", ${filters:raw}}[$__rate_interval]))',
          legendFormat: 'avg(rate)',
          fromExploreMetrics: true,
        },
      ]);
    });

    test('customFunction overrides queries preset (URL-wins precedence)', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'go_goroutines', type: 'gauge' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.MEDIUM,
          labelMatchers: [],
          addIgnoreUsageFilter: true,
          queries: [{ fn: 'min' }],
          customFunction: 'max',
        },
      });

      expect(result.queries[0].expr).toBe('max(go_goroutines{__ignore_usage__="", ${filters:raw}})');
      expect(result.queries[0].legendFormat).toBe('max');
    });

    test('unknown customFunction falls through to queries preset', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'go_goroutines', type: 'gauge' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.MEDIUM,
          labelMatchers: [],
          addIgnoreUsageFilter: true,
          queries: [{ fn: 'min' }],
          customFunction: 'bogus',
        },
      });

      expect(result.queries[0].expr).toBe('min(go_goroutines{__ignore_usage__="", ${filters:raw}})');
      expect(result.queries[0].legendFormat).toBe('min');
    });
  });

  describe('with group by label', () => {
    test('handles gauge metrics', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'go_goroutines', type: 'gauge' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.HIGH,
          labelMatchers: [{ key: 'instance', operator: '=', value: 'us-east:5000' }],
          addIgnoreUsageFilter: true,
          groupBy: 'job',
        },
      });

      expect(result.isRateQuery).toBe(false);
      expect(result.maxDataPoints).toBe(500);
      expect(result.queries).toStrictEqual([
        {
          refId: 'go_goroutines-by-job',
          expr: 'avg by (job) (go_goroutines{instance="us-east:5000", __ignore_usage__="", ${filters:raw}})',
          legendFormat: '{{job}}',
          fromExploreMetrics: true,
        },
      ]);
    });

    test('handles counter metrics', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'go_gc_heap_frees_bytes_total', type: 'counter' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.MEDIUM,
          labelMatchers: [{ key: 'job', operator: '!=', value: 'prometheus' }],
          addIgnoreUsageFilter: true,
          groupBy: 'instance',
        },
      });

      expect(result.isRateQuery).toBe(true);
      expect(result.maxDataPoints).toBe(250);
      expect(result.queries).toStrictEqual([
        {
          refId: 'go_gc_heap_frees_bytes_total-by-instance',
          expr: 'sum by (instance) (rate(go_gc_heap_frees_bytes_total{job!="prometheus", __ignore_usage__="", ${filters:raw}}[$__rate_interval]))',
          legendFormat: '{{instance}}',
          fromExploreMetrics: true,
        },
      ]);
    });

    test('applies customRateInterval override to grouped counter rate window', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'go_gc_heap_frees_bytes_total', type: 'counter' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.MEDIUM,
          labelMatchers: [{ key: 'job', operator: '!=', value: 'prometheus' }],
          addIgnoreUsageFilter: true,
          groupBy: 'instance',
          customRateInterval: '1h',
        },
      });

      expect(result.queries).toStrictEqual([
        {
          refId: 'go_gc_heap_frees_bytes_total-by-instance',
          expr: 'sum by (instance) (rate(go_gc_heap_frees_bytes_total{job!="prometheus", __ignore_usage__="", ${filters:raw}}[1h]))',
          legendFormat: '{{instance}}',
          fromExploreMetrics: true,
        },
      ]);
    });

    test('applies customFunction=max in group-by path (instant aggregation whitelist)', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'go_goroutines', type: 'gauge' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.MEDIUM,
          labelMatchers: [],
          addIgnoreUsageFilter: true,
          groupBy: 'job',
          customFunction: 'max',
        },
      });

      expect(result.queries[0].expr).toBe(
        'max by (job) (go_goroutines{__ignore_usage__="", ${filters:raw}})'
      );
    });

    test('range-vector customFunction falls back to type default in group-by path', () => {
      const result = getTimeseriesQueryRunnerParams({
        metric: { name: 'desired_shards', type: 'gauge' },
        queryConfig: {
          resolution: QUERY_RESOLUTION.MEDIUM,
          labelMatchers: [],
          addIgnoreUsageFilter: true,
          groupBy: 'job',
          customFunction: 'max_over_time',
        },
      });

      expect(result.queries[0].expr).toBe(
        'avg by (job) (desired_shards{__ignore_usage__="", ${filters:raw}})'
      );
    });

    describe('with UTF-8 labels', () => {
      test('wraps UTF-8 label in quotes for by clause and legendFormat', () => {
        const result = getTimeseriesQueryRunnerParams({
          metric: { name: 'http_requests_total', type: 'counter' },
          queryConfig: {
            resolution: QUERY_RESOLUTION.MEDIUM,
            labelMatchers: [],
            addIgnoreUsageFilter: true,
            groupBy: 'service.name',
          },
        });

        expect(result.queries).toStrictEqual([
          {
            refId: 'http_requests_total-by-service.name',
            expr: 'sum by ("service.name") (rate(http_requests_total{__ignore_usage__="", ${filters:raw}}[$__rate_interval]))',
            legendFormat: '{{"service.name"}}',
            fromExploreMetrics: true,
          },
        ]);
      });

      test('handles emoji labels', () => {
        const result = getTimeseriesQueryRunnerParams({
          metric: { name: 'go_goroutines', type: 'gauge' },
          queryConfig: {
            resolution: QUERY_RESOLUTION.HIGH,
            labelMatchers: [],
            addIgnoreUsageFilter: true,
            groupBy: '🔥label',
          },
        });

        expect(result.queries).toStrictEqual([
          {
            refId: 'go_goroutines-by-🔥label',
            expr: 'avg by ("🔥label") (go_goroutines{__ignore_usage__="", ${filters:raw}})',
            legendFormat: '{{"🔥label"}}',
            fromExploreMetrics: true,
          },
        ]);
      });

      test('handles labels with hyphens', () => {
        const result = getTimeseriesQueryRunnerParams({
          metric: { name: 'container_cpu_usage', type: 'gauge' },
          queryConfig: {
            resolution: QUERY_RESOLUTION.MEDIUM,
            labelMatchers: [],
            addIgnoreUsageFilter: true,
            groupBy: 'k8s-namespace',
          },
        });

        expect(result.queries).toStrictEqual([
          {
            refId: 'container_cpu_usage-by-k8s-namespace',
            expr: 'avg by ("k8s-namespace") (container_cpu_usage{__ignore_usage__="", ${filters:raw}})',
            legendFormat: '{{"k8s-namespace"}}',
            fromExploreMetrics: true,
          },
        ]);
      });

      test('does not wrap legacy-compatible labels in quotes', () => {
        const result = getTimeseriesQueryRunnerParams({
          metric: { name: 'up', type: 'gauge' },
          queryConfig: {
            resolution: QUERY_RESOLUTION.MEDIUM,
            labelMatchers: [],
            addIgnoreUsageFilter: true,
            groupBy: 'instance_name',
          },
        });

        // Legacy-compatible labels (alphanumeric + underscore, not starting with digit)
        // should NOT be wrapped in quotes
        expect(result.queries).toStrictEqual([
          {
            refId: 'up-by-instance_name',
            expr: 'avg by (instance_name) (up{__ignore_usage__="", ${filters:raw}})',
            legendFormat: '{{instance_name}}',
            fromExploreMetrics: true,
          },
        ]);
      });
    });
  });
});
