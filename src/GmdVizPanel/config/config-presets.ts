import { type LegendPlacement } from '@grafana/schema';

import { type PanelOptions, type QueryOptions } from 'GmdVizPanel/GmdVizPanel';
import { UP_DOWN_VALUE_MAPPINGS } from 'GmdVizPanel/statushistory/value-mappings';

import { QUERY_RESOLUTION } from './query-resolutions';

export enum PANEL_PRESET {
  TIMESERIES_AVG = 'timeseries-avg',
  TIMESERIES_SUM = 'timeseries-sum',
  TIMESERIES_STDDEV = 'timeseries-stddev',
  TIMESERIES_PERCENTILES = 'timeseries-percentiles',
  TIMESERIES_MIN_MAX = 'timeseries-minmax',
  TIMESERIES_AGE_TIME_MINUS_AVG = 'timeseries-age-time-minus-avg',
  TIMESERIES_AGE_AVG_TIME_MINUS_METRIC = 'timeseries-age-avg-time-minus-metric',
  HEATMAP = 'heatmap',
  PERCENTILES = 'percentiles',
  STATUS_HISTORY = 'status-history',
  STATUS_STAT = 'status-stat',
}

export type PanelConfigPreset = {
  id: string;
  name: string;
  panelOptions: PanelOptions;
  queryOptions: QueryOptions;
};

export const DEFAULT_TIMESERIES_PRESETS: Record<string, PanelConfigPreset> = {
  [PANEL_PRESET.TIMESERIES_AVG]: {
    id: String(PANEL_PRESET.TIMESERIES_AVG),
    name: 'Average',
    panelOptions: {
      type: 'timeseries',
      description:
        'Shows the average value across all time series. Ideal for understanding typical behavior and smoothing out variations between different targets. For rate queries, displays average throughput per target.',
    },
    queryOptions: {
      queries: [{ fn: 'avg' }],
    },
  },
  [PANEL_PRESET.TIMESERIES_SUM]: {
    id: String(PANEL_PRESET.TIMESERIES_SUM),
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
  [PANEL_PRESET.TIMESERIES_STDDEV]: {
    id: String(PANEL_PRESET.TIMESERIES_STDDEV),
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
  [PANEL_PRESET.TIMESERIES_PERCENTILES]: {
    id: String(PANEL_PRESET.TIMESERIES_PERCENTILES),
    name: 'Percentiles',
    panelOptions: {
      type: 'percentiles',
      description:
        'Displays 50th, 90th, and 99th percentiles to show value distribution. Excellent for SLA monitoring and understanding outlier behavior without being skewed by extreme values. Critical for performance analysis.',
      legend: { showLegend: true, placement: 'bottom' as LegendPlacement },
    },
    queryOptions: {
      queries: [{ fn: 'quantile', params: { percentiles: [99, 90, 50] } }],
    },
  },
  [PANEL_PRESET.TIMESERIES_MIN_MAX]: {
    id: String(PANEL_PRESET.TIMESERIES_MIN_MAX),
    name: 'Min/Max',
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

export const DEFAULT_TIMESERIES_AGE_PRESETS: Record<string, PanelConfigPreset> = {
  [PANEL_PRESET.TIMESERIES_AGE_TIME_MINUS_AVG]: {
    id: String(PANEL_PRESET.TIMESERIES_AGE_TIME_MINUS_AVG),
    name: 'Age: time - avg(metric)',
    panelOptions: {
      type: 'timeseries',
      description: '',
    },
    queryOptions: {
      queries: [{ fn: 'time-avg(metric)' }],
    },
  },
  [PANEL_PRESET.TIMESERIES_AGE_AVG_TIME_MINUS_METRIC]: {
    id: String(PANEL_PRESET.TIMESERIES_AGE_AVG_TIME_MINUS_METRIC),
    name: 'Age: avg(time - metric)',
    panelOptions: {
      type: 'timeseries',
      description: '',
    },
    queryOptions: {
      queries: [{ fn: 'avg(time-metric)' }],
    },
  },
} as const;

export const DEFAULT_HISTOGRAMS_PRESETS: Record<string, PanelConfigPreset> = {
  [PANEL_PRESET.HEATMAP]: {
    id: String(PANEL_PRESET.HEATMAP),
    name: 'Heatmap',
    panelOptions: {
      type: 'heatmap',
      description:
        'Visualizes the full distribution of histogram data over time using color intensity. Perfect for spotting patterns, identifying performance degradation, and understanding latency distribution changes. Shows density of values across different buckets.',
    },
    queryOptions: {},
  },
  [PANEL_PRESET.PERCENTILES]: {
    id: String(PANEL_PRESET.PERCENTILES),
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

export const DEFAULT_STATUS_UP_DOWN_PRESETS: Record<string, PanelConfigPreset> = {
  [PANEL_PRESET.STATUS_HISTORY]: {
    id: String(PANEL_PRESET.STATUS_HISTORY),
    name: 'Status History',
    panelOptions: {
      type: 'statushistory',
      description:
        'Displays binary status changes over time as colored bars (green=up, red=down). Perfect for monitoring service availability, health checks, or any binary state metrics. Shows patterns in uptime/downtime and helps identify recurring issues.',
    },
    queryOptions: {
      resolution: QUERY_RESOLUTION.MEDIUM,
      queries: [{ fn: 'min' }],
    },
  },
  [PANEL_PRESET.STATUS_STAT]: {
    id: String(PANEL_PRESET.STATUS_STAT),
    name: 'Stat (latest)',
    panelOptions: {
      type: 'stat',
      description:
        'Shows the current status as a single value display with color coding (green=up, red=down). Ideal for dashboards where you need an at-a-glance view of service health or binary state. Uses minimum value to ensure any "down" status is highlighted.',
      mappings: UP_DOWN_VALUE_MAPPINGS,
    },
    queryOptions: {
      resolution: QUERY_RESOLUTION.MEDIUM,
      queries: [{ fn: 'min' }],
    },
  },
} as const;
