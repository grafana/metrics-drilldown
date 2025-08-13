import { CONFIG_PRESET, type PanelConfigPreset } from './types';

export const DEFAULT_HISTOGRAMS_PRESETS: Record<string, PanelConfigPreset> = {
  [CONFIG_PRESET.HEATMAP]: {
    id: String(CONFIG_PRESET.HEATMAP),
    name: 'Heatmap (default)',
    panelOptions: {
      type: 'heatmap',
      description:
        'Visualizes the full distribution of histogram data over time using color intensity. Perfect for spotting patterns, identifying performance degradation, and understanding latency distribution changes. Shows density of values across different buckets.',
    },
    queryOptions: {},
  },
  [CONFIG_PRESET.PERCENTILES]: {
    id: String(CONFIG_PRESET.PERCENTILES),
    name: 'Percentiles',
    panelOptions: {
      type: 'percentiles',
      description:
        'Extracts specific percentile values (50th, 90th, 99th) from histogram data. Essential for SLA monitoring and performance analysis, showing how response times or other metrics behave for different user experience tiers.',
    },
    queryOptions: {
      queries: [{ fn: 'histogram_quantile', params: { percentiles: [99, 90, 50] } }],
    },
  },
} as const;
