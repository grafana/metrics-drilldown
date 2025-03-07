import { VariableHide, VariableRefresh, VariableSort } from '@grafana/data';
import { AdHocFiltersVariable, QueryVariable, sceneGraph, type SceneObjectState } from '@grafana/scenes';

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
      query: '',
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

    // hack to ensure that the correct metrics are loaded when landing: sometimes filters are not interpolated and fetching metric names gives all the results
    const adHocSub = sceneGraph.findByKeyAndType(this, VAR_FILTERS, AdHocFiltersVariable).subscribeToState(() => {
      const groupBy = labelsVariable.state.value;
      const matcher = groupBy !== NULL_GROUP_BY_VALUE ? `${groupBy}=~".+",$${VAR_FILTERS}` : `$${VAR_FILTERS}`;

      this.setState({ query: `label_values({${matcher}}, __name__)` });
      this.refreshOptions();

      adHocSub.unsubscribe();
    });

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
