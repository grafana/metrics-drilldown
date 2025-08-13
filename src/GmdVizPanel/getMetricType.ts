import { isHistogramMetric } from './heatmap/isHistogramMetric';
import { isAgeMetric } from './isAgeMetric';
import { isRateQuery } from './isRateQuery';
import { isUpDownMetric } from './statushistory/isUpDownMetric';

export type MetricType = 'status-updown' | 'histogram' | 'age' | 'counter' | 'gauge';

export function getMetricType(metric: string): MetricType {
  if (isUpDownMetric(metric)) {
    return 'status-updown';
  }

  if (isHistogramMetric(metric)) {
    return 'histogram';
  }

  if (isAgeMetric(metric)) {
    return 'age';
  }

  if (isRateQuery(metric)) {
    return 'counter';
  }

  return 'gauge';
}
