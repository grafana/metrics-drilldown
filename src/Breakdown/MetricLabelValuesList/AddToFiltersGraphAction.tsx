import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import React from 'react';

import { reportExploreMetrics } from 'interactions';
import { VAR_FILTERS } from 'shared';
import { getTrailFor } from 'utils';
import { isAdHocFiltersVariable } from 'utils/utils.variables';

export interface AddToFiltersGraphActionState extends SceneObjectState {
  labelName: string;
  labelValue: string;
}

export class AddToFiltersGraphAction extends SceneObjectBase<AddToFiltersGraphActionState> {
  public onClick = () => {
    const variable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (!isAdHocFiltersVariable(variable)) {
      return;
    }

    const { labelName, labelValue } = this.state;

    reportExploreMetrics('label_filter_changed', { label: labelName, action: 'added', cause: 'breakdown' });

    getTrailFor(this).addFilterWithoutReportingInteraction({
      key: labelName,
      operator: '=',
      value: labelValue,
    });
  };

  public static readonly Component = ({ model }: SceneComponentProps<AddToFiltersGraphAction>) => {
    return (
      <Button variant="secondary" size="sm" fill="outline" onClick={model.onClick}>
        Add to filters
      </Button>
    );
  };
}
