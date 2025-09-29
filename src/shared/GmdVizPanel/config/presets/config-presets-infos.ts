import { CONFIG_PRESETS, type ConfigPresetId, type PanelConfigPreset } from './types';

export const DEFAULT_TIMESERIES_INFO_PRESETS: Partial<Record<ConfigPresetId, PanelConfigPreset>> = {
  [CONFIG_PRESETS.TIMESERIES_COUNT]: {
    id: CONFIG_PRESETS.TIMESERIES_COUNT,
    name: 'Count',
    panelOptions: {
      type: 'timeseries',
      description: '',
    },
    queryOptions: {
      queries: [{ fn: 'count' }],
    },
  },
} as const;
