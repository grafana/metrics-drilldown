import { type MetricType } from './getMetricType';

// OpenMetrics defines exemplars only for Counter, Histogram, and GaugeHistogram metric types.
export function supportsExemplars(metricType: MetricType): boolean {
  return metricType === 'counter' || metricType === 'classic-histogram' || metricType === 'native-histogram';
}
