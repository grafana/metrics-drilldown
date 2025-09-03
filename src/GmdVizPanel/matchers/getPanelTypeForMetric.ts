import { type SceneObject } from '@grafana/scenes';

import { getPreferredConfigForMetric } from 'GmdVizPanel/config/getPreferredConfigForMetric';
import { type PanelType } from 'GmdVizPanel/types/available-panel-types';
import { getTrailFor } from 'utils';

import { isHistogramMetric } from './isHistogramMetric';
import { isStatusUpDownMetric } from './isStatusUpDownMetric';

export const getPanelTypeForMetric = async (sceneObject: SceneObject, metric: string): Promise<PanelType> => {
  const prefConfig = getPreferredConfigForMetric(metric);
  if (prefConfig?.panelOptions.type) {
    return prefConfig.panelOptions.type;
  }

  if (isStatusUpDownMetric(metric)) {
    return 'statushistory';
  }

  if (isHistogramMetric(metric)) {
    return 'heatmap';
  }

  const isNativeHistogram = await getTrailFor(sceneObject).isNativeHistogram(metric);
  if (isNativeHistogram) {
    return 'heatmap';
  }

  return 'timeseries';
};
