import { VariableHide, VariableRefresh, VariableSort } from '@grafana/data';
import { QueryVariable, type SceneObjectState } from '@grafana/scenes';

import { type LabelMatcher } from 'shared/GmdVizPanel/buildQueryExpression';
import { trailDS } from 'shared/shared';

import { VAR_METRICS_VAR_FILTERS } from './AdHocFiltersForMetricsVariable';
import { withLifecycleEvents } from './withLifecycleEvents';

export const VAR_METRICS_VARIABLE = 'metrics-wingman';

export type MetricOptions = Array<{ label: string; value: string }>;

interface MetricsVariableState extends SceneObjectState {
  key?: string;
  name?: string;
  labelMatcher?: LabelMatcher;
  addLifeCycleEvents?: boolean;
}

export class MetricsVariable extends QueryVariable {
  constructor({ key, name, labelMatcher, addLifeCycleEvents }: MetricsVariableState = {}) {
    super({
      key: key || VAR_METRICS_VARIABLE,
      name: name || VAR_METRICS_VARIABLE,
      label: 'Metrics',
      datasource: trailDS,
      query: labelMatcher
        ? `label_values({${labelMatcher.key}${labelMatcher.operator}"${labelMatcher.value}",$${VAR_METRICS_VAR_FILTERS}}, __name__)`
        : `label_values({$${VAR_METRICS_VAR_FILTERS}}, __name__)`,
      includeAll: true,
      value: '$__all',
      skipUrlSync: true,
      refresh: VariableRefresh.onTimeRangeChanged,
      sort: VariableSort.alphabeticalAsc,
      hide: VariableHide.hideVariable,
    });

    if (addLifeCycleEvents) {
      // required for filtering and sorting
      return withLifecycleEvents<MetricsVariable>(this);
    }
  }
}
