import { VariableHide, VariableRefresh, VariableSort } from '@grafana/data';
import { QueryVariable } from '@grafana/scenes';

import { trailDS, VAR_FILTERS } from 'shared';

export const VAR_METRICS_VARIABLE = 'metrics-wingman';

export class MetricsVariable extends QueryVariable {
  constructor() {
    super({
      name: VAR_METRICS_VARIABLE,
      label: 'Metrics',
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
