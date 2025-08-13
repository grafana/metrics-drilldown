import { promql } from 'tsqtsq';

import { type PrometheusFunction } from '../GmdVizPanel';

type MapEntry = {
  name: PrometheusFunction;
  fn: (args: any) => string;
};

const CLASSIC_FUNCTIONS: PrometheusFunction[] = ['avg', 'sum', 'stddev', 'quantile', 'min', 'max'];

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
