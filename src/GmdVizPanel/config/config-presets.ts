import { type LegendPlacement } from '@grafana/schema';

import { type PanelOptions, type QueryOptions } from 'GmdVizPanel/GmdVizPanel';

export enum PANEL_PRESET {
  TIMESERIES_AVG = 'timeseries-avg',
  TIMESERIES_SUM = 'timeseries-sum',
  TIMESERIES_STDDEV = 'timeseries-stddev',
  TIMESERIES_PERCENTILES = 'timeseries-percentiles',
  TIMESERIES_MIN_MAX = 'timeseries-min_max',
  HEATMAP = 'heatmap',
  PERCENTILES = 'percentiles',
  // TODO
  // STAT = 'stat',
  // AGE = 'age',
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
    panelOptions: { type: 'timeseries' },
    queryOptions: {
      queries: [{ fn: 'avg' }],
    },
  },
  [PANEL_PRESET.TIMESERIES_SUM]: {
    id: String(PANEL_PRESET.TIMESERIES_SUM),
    name: 'Sum',
    panelOptions: { type: 'timeseries' },
    queryOptions: {
      queries: [{ fn: 'sum' }],
    },
  },
  [PANEL_PRESET.TIMESERIES_STDDEV]: {
    id: String(PANEL_PRESET.TIMESERIES_STDDEV),
    name: 'Standard deviation',
    panelOptions: { type: 'timeseries' },
    queryOptions: {
      queries: [{ fn: 'stddev' }],
    },
  },
  [PANEL_PRESET.TIMESERIES_PERCENTILES]: {
    id: String(PANEL_PRESET.TIMESERIES_PERCENTILES),
    name: 'Percentiles',
    panelOptions: { type: 'percentiles', legend: { showLegend: true, placement: 'bottom' as LegendPlacement } },
    queryOptions: {
      queries: [{ fn: 'quantile', params: { percentiles: [99, 90, 50] } }],
    },
  },
  [PANEL_PRESET.TIMESERIES_MIN_MAX]: {
    id: String(PANEL_PRESET.TIMESERIES_MIN_MAX),
    name: 'Min/Max',
    panelOptions: { type: 'timeseries' },
    queryOptions: {
      queries: [{ fn: 'min' }, { fn: 'max' }],
    },
  },
} as const;

export const DEFAULT_HISTOGRAMS_PRESETS: Record<string, PanelConfigPreset> = {
  [PANEL_PRESET.HEATMAP]: {
    id: String(PANEL_PRESET.HEATMAP),
    name: 'Heatmap',
    panelOptions: { type: 'heatmap' },
    queryOptions: {},
  },
  [PANEL_PRESET.PERCENTILES]: {
    id: String(PANEL_PRESET.PERCENTILES),
    name: 'Percentiles',
    panelOptions: { type: 'percentiles' },
    queryOptions: {
      queries: [{ fn: 'histogram_quantile', params: { percentiles: [99, 90, 50] } }],
    },
  },
} as const;
