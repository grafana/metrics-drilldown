export const AVAILABLE_PANEL_TYPES = [
  'heatmap',
  'percentiles',
  'stat',
  'statushistory',
  'timeseries',
  // TODO for info metrics, see https://github.com/grafana/metrics-drilldown/issues/450
  // 'table',
] as const;

export type PanelType = (typeof AVAILABLE_PANEL_TYPES)[number];
