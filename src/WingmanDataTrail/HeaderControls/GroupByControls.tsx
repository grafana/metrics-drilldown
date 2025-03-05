import {
  sceneGraph,
  SceneObjectBase,
  VariableValueSelectors,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import React from 'react';

export const VAR_GROUP_BY = 'wingmanGroupBy';

export const groupByOptions = [
  { label: '(None)', value: 'none' },
  { label: 'cluster (2)', value: 'cluster' },
  { label: 'namespace (3)', value: 'namespace' },
  { label: 'service (11)', value: 'service' },
];

interface GroupByControlsState extends SceneObjectState {
  groupByControls: SceneObject;
}

export class GroupByControls extends SceneObjectBase<GroupByControlsState> {
  constructor(_state: Partial<GroupByControlsState>) {
    super({
      groupByControls: new VariableValueSelectors({
        layout: 'horizontal',
      }),
    });
  }

  public static Component = ({ model }: SceneComponentProps<GroupByControls>) => {
    const { groupByControls } = model.useState();

    const parentVariables = sceneGraph.getVariables(model);

    if (!parentVariables.getByName(VAR_GROUP_BY)) {
      console.warn('GroupByControls: VAR_GROUP_BY variable not found in parent');
      return null;
    }

    return <groupByControls.Component model={groupByControls} />;
  };
}
