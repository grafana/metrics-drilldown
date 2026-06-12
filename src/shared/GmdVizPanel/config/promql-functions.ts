import { promql } from 'tsqtsq';

const PROMETHEUS_FUNCTIONS = [
  // timeseries (rate and non-rate)
  'avg',
  'sum',
  'stddev',
  'quantile',
  'min',
  'max',
  'count',
  // range-vector aggregations (issue #1131)
  'max_over_time',
  'min_over_time',
  // histograms
  'histogram_quantile',
  // age
  'time-avg(metric)',
  'time-min(metric)',
  'time-max(metric)',
] as const;

export type PrometheusFunction = (typeof PROMETHEUS_FUNCTIONS)[number];

type MapEntry = {
  name: PrometheusFunction;
  fn: (args: any) => string;
};

export const PROMQL_FUNCTIONS = new Map<PrometheusFunction, MapEntry>([
  // methods exposed in the promql API
  ...['avg', 'sum', 'stddev', 'quantile', 'min', 'max', 'count'].map(
    (name) =>
      [
        name,
        {
          name,
          fn: (args: any) => (promql as any)[name](args),
        },
      ] as [PrometheusFunction, MapEntry]
  ),
  // custom functions that we define ourselves
  [
    'histogram_quantile',
    {
      name: 'histogram_quantile',
      // histogram_quantile is not available in the tsqtsq library
      fn: ({ expr, parameter }: { expr: string; parameter: number }) => `histogram_quantile(${parameter},${expr})`,
    },
  ],
  [
    'max_over_time',
    {
      name: 'max_over_time',
      // range-vector aggregation (issue #1131); interval defaults to $__rate_interval when not supplied
      fn: ({ expr, interval = '$__rate_interval' }: { expr: string; interval?: string }) =>
        `max_over_time(${expr}[${interval}])`,
    },
  ],
  [
    'min_over_time',
    {
      name: 'min_over_time',
      fn: ({ expr, interval = '$__rate_interval' }: { expr: string; interval?: string }) =>
        `min_over_time(${expr}[${interval}])`,
    },
  ],
  [
    'time-avg(metric)',
    {
      name: 'time-avg(metric)',
      fn: ({ expr }: { expr: string }) => `time()-avg(${expr})`,
    },
  ],
  [
    'time-min(metric)',
    {
      name: 'time-min(metric)',
      fn: ({ expr }: { expr: string }) => `time()-min(${expr})`,
    },
  ],
  [
    'time-max(metric)',
    {
      name: 'time-max(metric)',
      fn: ({ expr }: { expr: string }) => `time()-max(${expr})`,
    },
  ],
]);
