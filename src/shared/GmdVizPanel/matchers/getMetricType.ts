import { type DataTrail } from 'AppDataTrail/DataTrail';

import { isAgeMetric } from './isAgeMetric';
import { isClassicHistogramMetric } from './isClassicHistogramMetric';
import { isCounterMetric } from './isCounterMetric';
import { isStatusUpDownMetric } from './isStatusUpDownMetric';

export type MetricType = 'status-updown' | 'classic-histogram' | 'native-histogram' | 'age' | 'counter' | 'gauge';

export type Metric = {
  name: string;
  type: MetricType;
};

export async function getMetricType(metric: string, dataTrail: DataTrail): Promise<MetricType> {
  const metricType = getMetricTypeSync(metric);

  if (metricType === 'gauge') {
    const metadata = await dataTrail.getMetadataForMetric(metric);
    if (metadata?.type === 'histogram') {
      return 'native-histogram';
    }
  }

  if (metricType === 'counter') {
    const metadata = await dataTrail.getMetadataForMetric(metric);
    // we found a gauge metric that was previously identified as a counter (see https://github.com/grafana/metrics-drilldown/issues/698)
    if (metadata?.type === 'gauge') {
      return 'gauge';
    }
  }

  return metricType as MetricType;
}

/**
 * A sync version to use when performance is more important than correctness. If not, use the async version above.
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
