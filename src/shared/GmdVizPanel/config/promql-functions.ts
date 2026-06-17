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

// A range-vector aggregation takes a range vector and requires `[interval]`, e.g.
// max_over_time(metric[5m]). The canonical list lives in Prometheus's parser table at
// https://github.com/prometheus/prometheus/blob/main/promql/parser/functions.go (entries
// whose ArgTypes include ValueTypeMatrix). We do not vendor that list; instead we match on
// the `_over_time` suffix, the Prometheus naming convention for that family (issue #1131).
// KG owns picking a function that fits the call shape; any function name is emitted verbatim.
export function isRangeVectorFunction(fn: string): boolean {
  return fn.endsWith('_over_time');
}
