import { type DataTrail } from 'AppDataTrail/DataTrail';
import { type HistogramType } from 'GmdVizPanel/GmdVizPanel';
import { type PanelType } from 'GmdVizPanel/types/available-panel-types';

import { getMetricType } from './getMetricType';
import { isStatusUpDownMetric } from './isStatusUpDownMetric';

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
 * A sync version to use when we already know the histogram type and performance is important
 */
export function getPanelTypeForMetricSync(metric: string, histogramType: HistogramType): PanelType {
  if (histogramType === 'classic' || histogramType === 'native') {
    return 'heatmap';
  }

  return isStatusUpDownMetric(metric) ? 'statushistory' : 'timeseries';
}
