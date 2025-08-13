import { isHistogramMetric } from 'GmdVizPanel/heatmap/isHistogramMetric';
import { isAgeMetric } from 'GmdVizPanel/isAgeMetric';
import { isRateQuery } from 'GmdVizPanel/isRateQuery';
import { isUpDownMetric } from 'GmdVizPanel/statushistory/isUpDownMetric';

import { DEFAULT_TIMESERIES_AGE_PRESETS } from './config-presets-ages';
import { DEFAULT_HISTOGRAMS_PRESETS } from './config-presets-histograms';
import { DEFAULT_STATUS_UP_DOWN_PRESETS } from './config-presets-status-updown';
import { DEFAULT_TIMESERIES_PRESETS, DEFAULT_TIMESERIES_RATE_PRESETS } from './config-presets-timeseries';
import { type PanelConfigPreset } from './types';

export function getConfigPresetsForMetric(metric: string, isNativeHistogram: boolean): PanelConfigPreset[] {
  if (isUpDownMetric(metric)) {
    return Object.values(DEFAULT_STATUS_UP_DOWN_PRESETS);
  }

  if (isNativeHistogram || isHistogramMetric(metric)) {
    return Object.values(DEFAULT_HISTOGRAMS_PRESETS);
  }

  if (isAgeMetric(metric)) {
    return [Object.values(DEFAULT_TIMESERIES_PRESETS)[0], ...Object.values(DEFAULT_TIMESERIES_AGE_PRESETS)];
  }

  if (isRateQuery(metric)) {
    return Object.values(DEFAULT_TIMESERIES_RATE_PRESETS);
  }

  return Object.values(DEFAULT_TIMESERIES_PRESETS);
}
