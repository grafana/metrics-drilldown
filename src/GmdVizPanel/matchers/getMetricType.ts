import { isAgeMetric } from './isAgeMetric';
import { isCounterMetric } from './isCounterMetric';
import { isHistogramMetric } from './isHistogramMetric';
import { isStatusUpDownMetric } from './isStatusUpDownMetric';

export type MetricType = 'status-updown' | 'histogram' | 'age' | 'counter' | 'gauge';

export function getMetricType(metric: string): MetricType {
  if (isStatusUpDownMetric(metric)) {
    return 'status-updown';
  }

  if (isHistogramMetric(metric)) {
    return 'histogram';
  }

  if (isAgeMetric(metric)) {
    return 'age';
  }

  if (isCounterMetric(metric)) {
    return 'counter';
  }

  return 'gauge';
}
