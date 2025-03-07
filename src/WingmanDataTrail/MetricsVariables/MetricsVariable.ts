import { VariableHide, VariableRefresh, VariableSort } from '@grafana/data';
import { QueryVariable, sceneGraph, type SceneObjectState } from '@grafana/scenes';

import { trailDS, VAR_FILTERS } from 'shared';
import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';

import { VAR_WINGMAN_GROUP_BY, type LabelsVariable } from '../Labels/LabelsVariable';

export const VAR_METRICS_VARIABLE = 'metrics-wingman';

interface MetricsVariableState extends SceneObjectState {
  name?: string;
  label?: string;
}

export class MetricsVariable extends QueryVariable {
  constructor(state: Partial<MetricsVariableState>) {
    super({
      name: VAR_METRICS_VARIABLE,
      label: 'Metrics',
      ...state,
      datasource: trailDS,
      query: `label_values({$${VAR_FILTERS}}, __name__)`,
      includeAll: true,
      value: '$__all',
      skipUrlSync: true,
      refresh: VariableRefresh.onTimeRangeChanged,
      sort: VariableSort.alphabeticalAsc,
      hide: VariableHide.hideVariable,
    });
  }

  protected onActivate() {
    const labelsVariable = sceneGraph.lookupVariable(VAR_WINGMAN_GROUP_BY, this) as LabelsVariable;

    this._subs.add(
      labelsVariable.subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          const matcher =
            newState.value !== NULL_GROUP_BY_VALUE ? `${newState.value}=~".+",$${VAR_FILTERS}` : `$${VAR_FILTERS}`;

          this.setState({ query: `label_values({${matcher}}, __name__)` });
          this.refreshOptions();
        }
      })
    );
  }
}
