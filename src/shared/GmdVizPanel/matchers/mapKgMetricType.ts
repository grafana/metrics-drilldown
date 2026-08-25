import { type MetricType } from './getMetricType';

export const KG_METRIC_TYPES = ['counter', 'gauge', 'histogram', 'summary'] as const;
export type KgMetricType = (typeof KG_METRIC_TYPES)[number];

export function mapKgMetricType(kgType: KgMetricType): MetricType {
  switch (kgType) {
    case 'counter':
      return 'counter';
    case 'gauge':
      return 'gauge';
    case 'histogram':
      return 'classic-histogram';
    case 'summary':
      return 'summary';
  }
}
