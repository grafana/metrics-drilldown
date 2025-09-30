import { type DataTrail } from 'AppDataTrail/DataTrail';

import { getMetricType, getMetricTypeSync } from './getMetricType';
import { type PanelType } from '../types/available-panel-types';

/**
 * These are functions that receive a metric name to determine in which panel type they should be displayed.
 * Note that they don't consider user preferences stored in user storage.
 */
export async function getPanelTypeForMetric(metric: string, dataTrail: DataTrail): Promise<PanelType> {
  const metricType = await getMetricType(metric, dataTrail);

  switch (metricType) {
    case 'classic-histogram':
    case 'native-histogram':
      return 'heatmap';

    case 'status-updown':
      return 'statushistory';

    case 'counter':
    case 'age':
    default:
      return 'timeseries';
  }
}

/**
 * A sync version to use when performance is important. It'll be incorrect when the metric is a native histogram or
 * if the type definded in the metric's metadata differs from the heuristics used in getMetricTypeSync().
 * In both case, if correctness is key, use the async version above that fetch the metric metadata for correctness.
 */
export function getPanelTypeForMetricSync(metric: string): PanelType {
  const metricType = getMetricTypeSync(metric);

  switch (metricType) {
    case 'classic-histogram':
      return 'heatmap';

    case 'status-updown':
      return 'statushistory';

    case 'counter':
    case 'age':
    default:
      return 'timeseries';
  }
}
