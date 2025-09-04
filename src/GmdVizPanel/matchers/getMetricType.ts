import { type DataTrail } from 'DataTrail';

import { isAgeMetric } from './isAgeMetric';
import { isClassicHistogramMetric } from './isClassicHistogramMetric';
import { isCounterMetric } from './isCounterMetric';
import { isStatusUpDownMetric } from './isStatusUpDownMetric';

export type MetricType = 'status-updown' | 'classic-histogram' | 'native-histogram' | 'age' | 'counter' | 'gauge';

export async function getMetricType(metric: string, dataTrail: DataTrail): Promise<MetricType> {
  let metricType = getMetricTypeSync(metric);

  if (metricType === 'gauge') {
    if (await dataTrail.isNativeHistogram(metric)) {
      metricType = 'native-histogram';
    }
  }

  return metricType as MetricType;
}

/**
 * A sync version to use when performance is important or when the metadata for determing native histograms is missing
 */
export function getMetricTypeSync(metric: string): Omit<MetricType, 'native-histogram'> {
  if (isCounterMetric(metric)) {
    return 'counter';
  }

  if (isClassicHistogramMetric(metric)) {
    return 'classic-histogram';
  }

  if (isAgeMetric(metric)) {
    return 'age';
  }

  if (isStatusUpDownMetric(metric)) {
    return 'status-updown';
  }

  return 'gauge';
}
