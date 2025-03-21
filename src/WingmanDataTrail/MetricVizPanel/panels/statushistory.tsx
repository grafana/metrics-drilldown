import { PanelBuilders, type SceneObject, type SceneQueryRunner } from '@grafana/scenes';
import { MappingType, ThresholdsMode, VisibilityMode } from '@grafana/schema';

interface PanelProps {
  panelTitle: string;
  headerActions: SceneObject[];
  queryRunner: SceneQueryRunner;
}

export function buildStatusHistoryPanel({ panelTitle, headerActions, queryRunner }: PanelProps) {
  queryRunner.setState({ maxDataPoints: 100 });

  return (
    PanelBuilders.statushistory()
      .setTitle(panelTitle)
      // we clone to prevent Scenes warnings "SceneObject already has a parent set that is different from the new parent. You cannot share the same SceneObject instance in multiple scenes or in multiple different places of the same scene graph. Use SceneObject.clone() to duplicate a SceneObject or store a state key reference and use sceneGraph.findObject to locate it."
      .setHeaderActions(headerActions.map((action) => action.clone()))
      .setData(queryRunner)
      .setColor({ mode: 'thresholds' }) // Set color mode to enable threshold coloring
      .setMappings([
        {
          type: MappingType.ValueToText,
          options: {
            '0': {
              color: 'red',
              text: 'down',
            },
            '1': {
              color: 'green',
              text: 'up',
            },
          },
        },
      ])
      .setThresholds({
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: 0, color: 'red' },
          { value: 1, color: 'green' },
        ],
      })
      // Hide the threshold annotations
      .setOption('legend', { showLegend: false })
      .setOption('showValue', VisibilityMode.Never)
  );
}
