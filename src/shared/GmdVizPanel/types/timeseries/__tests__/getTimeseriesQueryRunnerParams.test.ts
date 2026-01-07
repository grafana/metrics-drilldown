import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';

import { getTimeseriesQueryRunnerParams } from '../getTimeseriesQueryRunnerParams';

describe('getTimeseriesQueryRunnerParams(options)', () => {
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
