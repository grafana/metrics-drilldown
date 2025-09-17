import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import React from 'react';

import { reportExploreMetrics } from 'interactions';
import { getTrailFor } from 'utils';

interface AddToFiltersGraphActionState extends SceneObjectState {
  labelName: string;
  labelValue: string;
}

export class AddToFiltersGraphAction extends SceneObjectBase<AddToFiltersGraphActionState> {
  public onClick = () => {
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
