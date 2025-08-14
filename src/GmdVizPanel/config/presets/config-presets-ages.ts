import { CONFIG_PRESET, type PanelConfigPreset } from "./types";

export const DEFAULT_TIMESERIES_AGE_PRESETS: Record<string, PanelConfigPreset> = {
  [CONFIG_PRESET.TIMESERIES_AGE_TIME_MINUS_AVG]: {
    id: String(CONFIG_PRESET.TIMESERIES_AGE_TIME_MINUS_AVG),
    name: 'Average age',
    panelOptions: {
      type: 'timeseries',
      description:
        'Suitable only for metrics that store unix timestamps (usually containing "timestamp_seconds" in their name) to calculate an average age. Calculates the age by subtracting the average timestamp value from current time.',
    },
    queryOptions: {
      queries: [{ fn: 'time-avg(metric)' }],
    },
  },
  [CONFIG_PRESET.TIMESERIES_AGE_TIME_MINUS_MIN_MAX]: {
    id: String(CONFIG_PRESET.TIMESERIES_AGE_TIME_MINUS_MIN_MAX),
    name: 'Minimum and maximum ages',
    panelOptions: {
      type: 'timeseries',
      description:
        'Suitable only for metrics that store unix timestamps (usually containing "timestamp_seconds" in their name) to calculate a minimum and a maximum age. Calculates the ages by subtracting the min and the max timestamp values from current time.',
    },
    queryOptions: {
      queries: [{ fn: 'time-min(metric)' }, { fn: 'time-max(metric)' }],
    },
  },
} as const;
