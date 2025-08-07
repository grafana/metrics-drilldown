import { PanelBuilders, type SceneObject, type SceneQueryRunner } from '@grafana/scenes';

import { extremeValueFilterBehavior } from '../../../autoQuery/behaviors/ExtremeValueFilterBehavior';

interface PanelProps {
  panelTitle: string;
  color: string;
  queryRunner: SceneQueryRunner;
  hideLegend: boolean;
  headerActions: SceneObject[];
}

export function buildTimeseriesPanel({ panelTitle, queryRunner, color, headerActions, hideLegend }: PanelProps) {
  return (
    PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setData(queryRunner)
      .setColor({ mode: 'fixed', fixedColor: color })
      .setCustomFieldConfig('fillOpacity', 9)
      .setCustomFieldConfig('pointSize', 1)
      // we clone to prevent Scenes warnings "SceneObject already has a parent set that is different from the new parent. You cannot share the same SceneObject instance in multiple scenes or in multiple different places of the same scene graph. Use SceneObject.clone() to duplicate a SceneObject or store a state key reference and use sceneGraph.findObject to locate it."
      .setHeaderActions(headerActions.map((action) => action.clone()))
      .setOption('legend', { showLegend: !hideLegend })
      .setBehaviors([extremeValueFilterBehavior])
  );
}
