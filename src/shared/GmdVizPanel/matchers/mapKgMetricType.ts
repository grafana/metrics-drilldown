import { type MetricType } from './getMetricType';

export type KgMetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export function mapKgMetricType(kgType: KgMetricType): MetricType {
  switch (kgType) {
    case 'counter':
      return 'counter';
    case 'gauge':
      return 'gauge';
    case 'histogram':
      return 'classic-histogram';
    case 'summary':
      return 'gauge';
  }
}
