import { type PrometheusFunction } from 'shared/GmdVizPanel/config/promql-functions';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { logger } from 'shared/logger/logger';

import { getStatQueryRunnerParams } from '../getStatQueryRunnerParams';

describe('getStatQueryRunnerParams(options)', () => {
  test('handles gauge metrics', () => {
    const result = getStatQueryRunnerParams({
      metric: { name: 'go_goroutines', type: 'gauge' },
      queryConfig: {
        resolution: QUERY_RESOLUTION.HIGH,
        labelMatchers: [{ key: 'instance', operator: '=', value: 'us-east:5000' }],
        addIgnoreUsageFilter: true,
        queries: [],
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

  test('skips unknown PromQL function and logs a warning', () => {
    const result = getStatQueryRunnerParams({
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
      '[getStatQueryRunnerParams] Unknown PromQL function "unknown_fn", skipping query.'
    );
  });

  test('handles counter metrics', () => {
    const result = getStatQueryRunnerParams({
      metric: { name: 'go_gc_heap_frees_bytes_total', type: 'counter' },
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [{ key: 'job', operator: '!=', value: 'prometheus' }],
        addIgnoreUsageFilter: true,
        queries: [],
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
    const result = getStatQueryRunnerParams({
      metric: { name: 'go_gc_heap_frees_bytes_total', type: 'counter' },
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [{ key: 'job', operator: '!=', value: 'prometheus' }],
        addIgnoreUsageFilter: true,
        queries: [],
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

  test('applies customFunction=max_over_time on a gauge with default interval', () => {
    const result = getStatQueryRunnerParams({
      metric: { name: 'desired_shards', type: 'gauge' },
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [],
        addIgnoreUsageFilter: true,
        queries: [],
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
    const result = getStatQueryRunnerParams({
      metric: { name: 'desired_shards', type: 'gauge' },
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [],
        addIgnoreUsageFilter: true,
        queries: [],
        customFunction: 'max_over_time',
        customRateInterval: '5m',
      },
    });

    expect(result.queries[0].expr).toBe(
      'max_over_time(desired_shards{__ignore_usage__="", ${filters:raw}}[5m])'
    );
  });

  test('counter with customFunction=avg still wraps in rate', () => {
    const result = getStatQueryRunnerParams({
      metric: { name: 'http_requests_total', type: 'counter' },
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [],
        addIgnoreUsageFilter: true,
        queries: [],
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
    const result = getStatQueryRunnerParams({
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
    const result = getStatQueryRunnerParams({
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
