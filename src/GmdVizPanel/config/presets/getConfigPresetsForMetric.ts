import { DEFAULT_TIMESERIES_AGE_PRESETS } from './config-presets-ages';
import { DEFAULT_HISTOGRAMS_PRESETS } from './config-presets-histograms';
import { DEFAULT_STATUS_UP_DOWN_PRESETS } from './config-presets-status-updown';
import { DEFAULT_TIMESERIES_PRESETS, DEFAULT_TIMESERIES_RATE_PRESETS } from './config-presets-timeseries';
import { type PanelConfigPreset } from './types';
import { isCounterMetric } from '../..//matchers/isCounterMetric';
import { isHistogramMetric } from '../..//matchers/isHistogramMetric';
import { isAgeMetric } from '../../matchers/isAgeMetric';
import { isStatusUpDownMetric } from '../../matchers/isStatusUpDownMetric';

export function getConfigPresetsForMetric(metric: string, isNativeHistogram: boolean): PanelConfigPreset[] {
  if (isStatusUpDownMetric(metric)) {
    return Object.values(DEFAULT_STATUS_UP_DOWN_PRESETS);
  }

  if (isNativeHistogram || isHistogramMetric(metric)) {
    return Object.values(DEFAULT_HISTOGRAMS_PRESETS);
  }

  if (isAgeMetric(metric)) {
    return [Object.values(DEFAULT_TIMESERIES_PRESETS)[0], ...Object.values(DEFAULT_TIMESERIES_AGE_PRESETS)];
  }

  if (isCounterMetric(metric)) {
    return Object.values(DEFAULT_TIMESERIES_RATE_PRESETS);
  }

  return Object.values(DEFAULT_TIMESERIES_PRESETS);
}
