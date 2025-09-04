import { type DataTrail } from 'DataTrail';
import { type HistogramType } from 'GmdVizPanel/GmdVizPanel';
import { type PanelType } from 'GmdVizPanel/types/available-panel-types';

import { isClassicHistogramMetric } from './isClassicHistogramMetric';
import { isStatusUpDownMetric } from './isStatusUpDownMetric';

/**
 * These are functions that receive a metric name to determine in which panel type they should be displayed.
 * Note that they don't consider user preferences stored in user storage.
 */
export async function getPanelTypeForMetric(metric: string, dataTrail: DataTrail): Promise<PanelType> {
  if (isStatusUpDownMetric(metric)) {
    return 'statushistory';
  }

  if (isClassicHistogramMetric(metric)) {
    return 'heatmap';
  }

  if (await dataTrail.isNativeHistogram(metric)) {
    return 'heatmap';
  }

  return 'timeseries';
}

/**
 * A sync version to use when we already know the histogram type and performance is important
 */
export function getPanelTypeForMetricSync(metric: string, histogramType: HistogramType): PanelType {
  if (isStatusUpDownMetric(metric)) {
    return 'statushistory';
  }

  if (histogramType === 'classic' || histogramType === 'native') {
    return 'heatmap';
  }

  return 'timeseries';
}
