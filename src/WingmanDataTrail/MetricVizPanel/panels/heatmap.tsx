import { PanelBuilders, type SceneObject, type SceneQueryRunner } from '@grafana/scenes';
import { HeatmapColorMode } from '@grafana/schema/dist/esm/raw/composable/heatmap/panelcfg/x/HeatmapPanelCfg_types.gen';

interface PanelProps {
  panelTitle: string;
  color: string;
  queryRunner: SceneQueryRunner;
  hideLegend: boolean;
  headerActions: SceneObject[];
}

export function buildHeatmapPanel({ panelTitle, queryRunner, color, headerActions, hideLegend }: PanelProps) {
  return (
    PanelBuilders.heatmap()
      .setTitle(panelTitle)
      .setData(queryRunner)
      .setOption('calculate', false)
      .setOption('color', {
        mode: HeatmapColorMode.Scheme,
        exponent: 0.5,
        scheme: 'Spectral',
        steps: 32,
        reverse: false,
      })
      // we clone to prevent Scenes warnings "SceneObject already has a parent set that is different from the new parent. You cannot share the same SceneObject instance in multiple scenes or in multiple different places of the same scene graph. Use SceneObject.clone() to duplicate a SceneObject or store a state key reference and use sceneGraph.findObject to locate it."
      .setHeaderActions(headerActions.map((action) => action.clone()))
      .setOption('legend', { show: !hideLegend })
  );
}
