import { CONFIG_PRESETS, type ConfigPresetId, type PanelConfigPreset } from './types';

export const DEFAULT_TIMESERIES_PRESETS: Partial<Record<ConfigPresetId, PanelConfigPreset>> = {
  [CONFIG_PRESETS.TIMESERIES_AVG]: {
    id: CONFIG_PRESETS.TIMESERIES_AVG,
    name: 'Average (default)',
    panelOptions: {
      type: 'timeseries',
      description:
        'Shows the average value across all time series. Ideal for understanding typical behavior and smoothing out variations between different targets. For rate queries, displays average throughput per target.',
    },
    queryOptions: {
      queries: [{ fn: 'avg' }],
    },
  },
  [CONFIG_PRESETS.TIMESERIES_SUM]: {
    id: CONFIG_PRESETS.TIMESERIES_SUM,
    name: 'Sum',
    panelOptions: {
      type: 'timeseries',
      description:
        'Aggregates total values across all time series. Perfect for measuring overall system throughput, total resource consumption, or fleet-wide capacity. Essential for rate queries showing total request rates.',
    },
    queryOptions: {
      queries: [{ fn: 'sum' }],
    },
  },
  [CONFIG_PRESETS.TIMESERIES_STDDEV]: {
    id: CONFIG_PRESETS.TIMESERIES_STDDEV,
    name: 'Standard deviation',
    panelOptions: {
      type: 'timeseries',
      description:
        'Measures variability and consistency across time series. High values indicate uneven load distribution or inconsistent behavior. Useful for detecting load balancing issues or identifying when some targets behave differently.',
    },
    queryOptions: {
      queries: [{ fn: 'stddev' }],
    },
  },
  [CONFIG_PRESETS.TIMESERIES_PERCENTILES]: {
    id: CONFIG_PRESETS.TIMESERIES_PERCENTILES,
    name: 'Percentiles',
    panelOptions: {
      type: 'percentiles',
      description:
        'Displays percentiles to show value distribution. Excellent for SLA monitoring and understanding outlier behavior without being skewed by extreme values. Critical for performance analysis.',
    },
    queryOptions: {
      queries: [{ fn: 'quantile', params: { percentiles: [99, 90, 50] } }],
    },
  },
  [CONFIG_PRESETS.TIMESERIES_MIN_MAX]: {
    id: CONFIG_PRESETS.TIMESERIES_MIN_MAX,
    name: 'Minimum and maximum',
    panelOptions: {
      type: 'timeseries',
      description:
        'Shows the range between lowest and highest values across time series. Useful for capacity planning, identifying idle resources (min), and spotting overloaded targets (max). Helps detect outliers and resource utilization patterns.',
    },
    queryOptions: {
      queries: [{ fn: 'min' }, { fn: 'max' }],
    },
  },
} as const;

// the presets are arranged so the first one is always the default one
// this is why we define the default rate presets and we don't use DEFAULT_TIMESERIES_PRESETS in GmdVizPanel.tsx
export const DEFAULT_TIMESERIES_RATE_PRESETS: Partial<Record<ConfigPresetId, PanelConfigPreset>> = {
  [CONFIG_PRESETS.TIMESERIES_SUM]: {
    ...DEFAULT_TIMESERIES_PRESETS[CONFIG_PRESETS.TIMESERIES_SUM],
    name: 'Sum (default)',
    id: CONFIG_PRESETS.TIMESERIES_SUM,
  } as PanelConfigPreset,
  [CONFIG_PRESETS.TIMESERIES_AVG]: {
    ...DEFAULT_TIMESERIES_PRESETS[CONFIG_PRESETS.TIMESERIES_AVG],
    name: 'Average',
  } as PanelConfigPreset,
  [CONFIG_PRESETS.TIMESERIES_STDDEV]: DEFAULT_TIMESERIES_PRESETS[CONFIG_PRESETS.TIMESERIES_STDDEV] as PanelConfigPreset,
  [CONFIG_PRESETS.TIMESERIES_PERCENTILES]: DEFAULT_TIMESERIES_PRESETS[
    CONFIG_PRESETS.TIMESERIES_PERCENTILES
  ] as PanelConfigPreset,
  [CONFIG_PRESETS.TIMESERIES_MIN_MAX]: DEFAULT_TIMESERIES_PRESETS[
    CONFIG_PRESETS.TIMESERIES_MIN_MAX
  ] as PanelConfigPreset,
} as const;
