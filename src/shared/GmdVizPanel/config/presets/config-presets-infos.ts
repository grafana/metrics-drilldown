import { CONFIG_PRESETS, type ConfigPresetId, type PanelConfigPreset } from './types';

export const DEFAULT_TIMESERIES_INFO_PRESETS: Partial<Record<ConfigPresetId, PanelConfigPreset>> = {
  [CONFIG_PRESETS.TIMESERIES_COUNT]: {
    id: CONFIG_PRESETS.TIMESERIES_COUNT,
    name: 'Count',
    panelOptions: {
      type: 'timeseries',
      description:
        'Counts how many time series emit this info metric. Useful for validating presence of instances and tracking metadata changes (e.g. version rollouts). Combine with a group by label (such as version or instance) to see the breakdown.',
    },
    queryOptions: {
      queries: [{ fn: 'count' }],
    },
  },
} as const;
