import { VariableHide, type AdHocVariableFilter } from '@grafana/data';
import { utf8Support } from '@grafana/prometheus';
import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';

import { VAR_FILTERS } from 'shared/shared';

export const VAR_METRICS_VAR_FILTERS = 'metrics_filters';

// This mirror variable keeps the main AdHoc filters in sync, allowing us to construct an expression that includes __name__ label matchers to
// enable MetricsVariable to fetch the metrics list when __name__ is included (see DataTrail.tsx for the main AdHoc filters)
export class AdHocFiltersForMetricsVariable extends AdHocFiltersVariable {
  constructor() {
    super({
      key: VAR_METRICS_VAR_FILTERS,
      name: VAR_METRICS_VAR_FILTERS,
      hide: VariableHide.hideVariable,
      allowCustomValue: true,
      applyMode: 'manual',
      expressionBuilder: (filters: AdHocVariableFilter[]) =>
        filters.map((filter) => `${utf8Support(filter.key)}${filter.operator}"${filter.value}"`).join(','),
      skipUrlSync: true,
    });

    this.addActivationHandler(() => {
      const filtersVariable = sceneGraph.findByKeyAndType(this, VAR_FILTERS, AdHocFiltersVariable);

      const update = (newState: any) => {
        this.setState({
          baseFilters: newState.baseFilters,
          filters: newState.filters,
        });
      };

      update(filtersVariable.state);

      const sub = filtersVariable.subscribeToState((newState, prevState) => {
        if (newState.baseFilters !== prevState.baseFilters || newState.filters !== prevState.filters) {
          update(newState);
        }
      });

      return () => {
        sub.unsubscribe();
      };
    });
  }
}
