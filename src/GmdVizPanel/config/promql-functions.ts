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
    'time-avg',
    {
      name: 'time-avg',
      fn: ({ expr }: { expr: string }) => `time()-avg(${expr})`,
    },
  ],
  [
    'avg(time-metric)',
    {
      name: 'avg(time-metric)',
      fn: ({ expr }: { expr: string }) => `avg(time()-${expr})`,
    },
  ],
]);
