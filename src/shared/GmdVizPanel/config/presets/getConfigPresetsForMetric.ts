import { type MetricType } from 'shared/GmdVizPanel/matchers/getMetricType';

import { DEFAULT_TIMESERIES_AGE_PRESETS } from './config-presets-ages';
import { DEFAULT_HISTOGRAMS_PRESETS } from './config-presets-histograms';
import { DEFAULT_TIMESERIES_INFO_PRESETS } from './config-presets-infos';
import { DEFAULT_STATUS_UP_DOWN_PRESETS } from './config-presets-status-updown';
import { DEFAULT_TIMESERIES_PRESETS, DEFAULT_TIMESERIES_RATE_PRESETS } from './config-presets-timeseries';
import { type PanelConfigPreset } from './types';

// Takes the already-resolved metric type instead of re-deriving it: by the time the configure drawer is
// open, GmdVizPanel has already resolved the type via metadata and/or the native-histogram probe, and
// re-deriving here (metadata-only, no probe) would disagree with it. See metrics-drilldown#1228.
export function getConfigPresetsForMetric(metricType: MetricType): PanelConfigPreset[] {
  switch (metricType) {
    case 'counter':
      return Object.values(DEFAULT_TIMESERIES_RATE_PRESETS);

    case 'classic-histogram':
    case 'native-histogram':
      return Object.values(DEFAULT_HISTOGRAMS_PRESETS);

    case 'age':
      return [Object.values(DEFAULT_TIMESERIES_PRESETS)[0], ...Object.values(DEFAULT_TIMESERIES_AGE_PRESETS)];

    case 'status-updown':
      return Object.values(DEFAULT_STATUS_UP_DOWN_PRESETS);

    case 'info':
      return Object.values(DEFAULT_TIMESERIES_INFO_PRESETS);

    default:
      return Object.values(DEFAULT_TIMESERIES_PRESETS);
  }
}
