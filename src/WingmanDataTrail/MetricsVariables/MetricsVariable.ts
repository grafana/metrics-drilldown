import { VariableHide, VariableRefresh, VariableSort } from '@grafana/data';
import { QueryVariable, type SceneObjectState } from '@grafana/scenes';

import { trailDS, VAR_FILTERS } from 'shared';

export const VAR_METRICS_VARIABLE = 'metrics-wingman';

export type MetricOptions = Array<{ label: string; value: string }>;

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
}
