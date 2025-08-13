import { promql } from 'tsqtsq';

export type PrometheusFunction =
  // timeseries (rate and non-rate)
  | 'avg'
  | 'sum'
  | 'stddev'
  | 'quantile'
  | 'min'
  | 'max'
  // histograms
  | 'histogram_quantile'
  // age
  | 'time-avg(metric)'
  | 'time-min(metric)'
  | 'time-max(metric)';

const CLASSIC_FUNCTIONS: PrometheusFunction[] = ['avg', 'sum', 'stddev', 'quantile', 'min', 'max'];

type MapEntry = {
  name: PrometheusFunction;
  fn: (args: any) => string;
};

export const PROMQL_FUNCTIONS = new Map<PrometheusFunction, MapEntry>([
  ...CLASSIC_FUNCTIONS.map(
    (name) => [name, { name, fn: (args: any) => (promql as any)[name](args) }] as [PrometheusFunction, MapEntry]
  ),
  [
    'histogram_quantile',
    {
      name: 'histogram_quantile',
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
