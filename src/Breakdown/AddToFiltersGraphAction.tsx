import { type DataFrame } from '@grafana/data';
import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import React from 'react';

import { VAR_FILTERS } from 'shared';

import { reportExploreMetrics } from '../interactions';
import { getTrailFor } from '../utils';
import { isAdHocFiltersVariable } from '../utils/utils.variables';

export interface AddToFiltersGraphActionState extends SceneObjectState {
  frame: DataFrame;
}

export class AddToFiltersGraphAction extends SceneObjectBase<AddToFiltersGraphActionState> {
  public onClick = () => {
    const variable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (!isAdHocFiltersVariable(variable)) {
      return;
    }

    const labels = this.state.frame.fields[1]?.labels ?? {};
    if (Object.keys(labels).length !== 1) {
      return;
    }

    const labelName = Object.keys(labels)[0];
    reportExploreMetrics('label_filter_changed', { label: labelName, action: 'added', cause: 'breakdown' });
    const trail = getTrailFor(this);
    const filter = {
      key: labelName,
      operator: '=',
      value: labels[labelName],
    };

    trail.addFilterWithoutReportingInteraction(filter);
  };

  public static readonly Component = ({ model }: SceneComponentProps<AddToFiltersGraphAction>) => {
    const state = model.useState();
    const labels = state.frame.fields[1]?.labels || {};

    const canAddToFilters = Object.keys(labels).length !== 0;

    if (!canAddToFilters) {
      return null;
    }

    return (
      <Button variant="secondary" size="sm" fill="outline" onClick={model.onClick}>
        Add to filters
      </Button>
    );
  };
}
