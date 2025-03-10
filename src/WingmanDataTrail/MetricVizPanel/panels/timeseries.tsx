import { PanelBuilders, type SceneQueryRunner, type VizPanelState } from '@grafana/scenes';

interface PanelProps {
  panelTitle: string;
  color: string;
  queryRunner: SceneQueryRunner;
  hideLegend: boolean;
  headerActions?: VizPanelState['headerActions'];
}

export function buildTimeseriesPanel({ panelTitle, queryRunner, color, headerActions, hideLegend }: PanelProps) {
  return PanelBuilders.timeseries()
    .setTitle(panelTitle)
    .setData(queryRunner)
    .setColor({ mode: 'fixed', fixedColor: color })
    .setCustomFieldConfig('fillOpacity', 9)
    .setHeaderActions(headerActions)
    .setOption('legend', { showLegend: !hideLegend });
}
