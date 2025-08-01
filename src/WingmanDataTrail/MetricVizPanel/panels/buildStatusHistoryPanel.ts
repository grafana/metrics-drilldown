import { type ValueMapping } from '@grafana/data';
import { PanelBuilders, type SceneObject, type SceneQueryRunner } from '@grafana/scenes';
import { MappingType, VisibilityMode } from '@grafana/schema';

interface PanelProps {
  panelTitle: string;
  headerActions: SceneObject[];
  queryRunner: SceneQueryRunner;
}

const mappings: ValueMapping[] = [
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
];

export function buildStatusHistoryPanel({ panelTitle, headerActions, queryRunner }: PanelProps) {
  queryRunner.setState({ maxDataPoints: 100 });

  return (
    PanelBuilders.statushistory()
      .setTitle(panelTitle)
      // we clone to prevent Scenes warnings "SceneObject already has a parent set that is different from the new parent. You cannot share the same SceneObject instance in multiple scenes or in multiple different places of the same scene graph. Use SceneObject.clone() to duplicate a SceneObject or store a state key reference and use sceneGraph.findObject to locate it."
      .setHeaderActions(headerActions.map((action) => action.clone()))
      .setData(queryRunner)
      // Use value mappings for both color and text display
      .setColor({ mode: 'palette-classic' })
      .setMappings(mappings)
      .setOption('legend', { showLegend: true })
      .setOption('perPage', 0)
      .setOption('showValue', VisibilityMode.Never)
      .setDisplayName('status') // TODO: it's not applied by Scenes (tested ok when creating manually a dashboard), find out why
  );
}
