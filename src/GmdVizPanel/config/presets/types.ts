import { type PanelOptions, type QueryOptions } from 'GmdVizPanel/GmdVizPanel';

export enum CONFIG_PRESET {
  TIMESERIES_AVG = 'timeseries-avg',
  TIMESERIES_SUM = 'timeseries-sum',
  TIMESERIES_STDDEV = 'timeseries-stddev',
  TIMESERIES_PERCENTILES = 'timeseries-percentiles',
  TIMESERIES_MIN_MAX = 'timeseries-minmax',
  TIMESERIES_AGE_TIME_MINUS_AVG = 'timeseries-age-time-minus-avg',
  TIMESERIES_AGE_TIME_MINUS_MIN_MAX = 'timeseries-age-time-minus-min-max',
  HEATMAP = 'heatmap',
  PERCENTILES = 'percentiles',
  STATUS_HISTORY_UPDOWN = 'status-history-updown',
  STATUS_STAT_UPDOWN = 'status-stat-updown',
}

export type PanelConfigPreset = {
  id: string;
  name?: string;
  panelOptions: PanelOptions;
  queryOptions: QueryOptions;
};
