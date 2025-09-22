import { type DataTrail } from 'AppDataTrail/DataTrail';
import { getMetricType } from 'shared/GmdVizPanel/matchers/getMetricType';

import { DEFAULT_TIMESERIES_AGE_PRESETS } from './config-presets-ages';
import { DEFAULT_HISTOGRAMS_PRESETS } from './config-presets-histograms';
import { DEFAULT_STATUS_UP_DOWN_PRESETS } from './config-presets-status-updown';
import { DEFAULT_TIMESERIES_PRESETS, DEFAULT_TIMESERIES_RATE_PRESETS } from './config-presets-timeseries';
import { type PanelConfigPreset } from './types';

export async function getConfigPresetsForMetric(metric: string, dataTrail: DataTrail): Promise<PanelConfigPreset[]> {
  const metricType = await getMetricType(metric, dataTrail);

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

    default:
      return Object.values(DEFAULT_TIMESERIES_PRESETS);
  }
}
