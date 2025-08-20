import { promql } from 'tsqtsq';

const PROMETHEUS_FUNCTIONS = [
  // timeseries (rate and non-rate)
  'avg',
  'sum',
  'stddev',
  'quantile',
  'min',
  'max',
  // histograms
  'histogram_quantile',
  // age
  'time-avg(metric)',
  'time-min(metric)',
  'time-max(metric)',
];

export type PrometheusFunction = (typeof PROMETHEUS_FUNCTIONS)[number];

type MapEntry = {
  name: PrometheusFunction;
  fn: (args: any) => string;
};

export const PROMQL_FUNCTIONS = new Map<PrometheusFunction, MapEntry>([
  // methods exposed in the promql API
  ...['avg', 'sum', 'stddev', 'quantile', 'min', 'max'].map(
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
