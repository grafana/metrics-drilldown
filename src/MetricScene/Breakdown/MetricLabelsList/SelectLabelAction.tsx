import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import React from 'react';

import { VAR_GROUP_BY } from 'shared';
import { isQueryVariable } from 'utils/utils.variables';

import { reportExploreMetrics } from '../../../interactions';

interface SelectLabelActionState extends SceneObjectState {
  label: string;
}

export class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
  public onClick = () => {
    const { label } = this.state;

    reportExploreMetrics('breakdown_panel_selected', { label });

    const groupByVariable = sceneGraph.lookupVariable(VAR_GROUP_BY, this)!;
    if (!isQueryVariable(groupByVariable)) {
      throw new Error('Group by variable not found');
    }
    groupByVariable.changeValueTo(label);
  };

  public static readonly Component = ({ model }: SceneComponentProps<SelectLabelAction>) => {
    return (
      <Button variant="secondary" size="sm" fill="outline" onClick={model.onClick}>
        Select
      </Button>
    );
  };
}
