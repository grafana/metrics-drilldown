import { type PanelOptions, type QueryOptions } from 'shared/GmdVizPanel/GmdVizPanel';

export const CONFIG_PRESETS = {
  TIMESERIES_AVG: 'timeseries-avg',
  TIMESERIES_SUM: 'timeseries-sum',
  TIMESERIES_STDDEV: 'timeseries-stddev',
  TIMESERIES_PERCENTILES: 'timeseries-percentiles',
  TIMESERIES_MIN_MAX: 'timeseries-minmax',
  TIMESERIES_COUNT: 'timeseries-count',
  TIMESERIES_AGE_TIME_MINUS_AVG: 'timeseries-age-time-minus-avg',
  TIMESERIES_AGE_TIME_MINUS_MIN_MAX: 'timeseries-age-time-minus-min-max',
  HISTOGRAM_HEATMAP: 'histogram-heatmap',
  HISTOGRAM_PERCENTILES: 'histogram-percentiles',
  STATUS_UPDOWN_HISTORY: 'status-updown-history',
  STATUS_UPDOWN_STAT: 'status-updown-stat',
} as const;

export type ConfigPresetId = (typeof CONFIG_PRESETS)[keyof typeof CONFIG_PRESETS];

export type PanelConfigPreset = {
  id: ConfigPresetId;
  name?: string;
  panelOptions: PanelOptions;
  queryOptions: QueryOptions;
};
