import { CONFIG_PRESETS, type ConfigPresetId, type PanelConfigPreset } from './types';

export const DEFAULT_HISTOGRAMS_PRESETS: Partial<Record<ConfigPresetId, PanelConfigPreset>> = {
  [CONFIG_PRESETS.HISTOGRAM_HEATMAP]: {
    id: CONFIG_PRESETS.HISTOGRAM_HEATMAP,
    name: 'Heatmap (default)',
    panelOptions: {
      type: 'heatmap',
      description:
        'Visualizes the full distribution of histogram data over time using color intensity. Perfect for spotting patterns, identifying performance degradation, and understanding latency distribution changes. Shows density of values across different buckets.',
    },
    queryOptions: {
      queries: [],
    },
  },
  [CONFIG_PRESETS.HISTOGRAM_PERCENTILES]: {
    id: CONFIG_PRESETS.HISTOGRAM_PERCENTILES,
    name: 'Percentiles',
    panelOptions: {
      type: 'percentiles',
      description:
        'Extracts specific percentile values from histogram data. Essential for SLA monitoring and performance analysis, showing how response times or other metrics behave for different user experience tiers.',
    },
    queryOptions: {
      queries: [{ fn: 'histogram_quantile', params: { percentiles: [99, 90, 50] } }],
    },
  },
} as const;
