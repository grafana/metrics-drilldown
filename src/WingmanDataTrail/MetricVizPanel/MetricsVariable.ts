import { VariableHide, VariableRefresh, VariableSort } from '@grafana/data';
import { QueryVariable } from '@grafana/scenes';

import { VAR_DATASOURCE, VAR_FILTERS } from 'shared';

export const VAR_METRICS_VARIABLE = 'metrics-wingman';

export class MetricsVariable extends QueryVariable {
  constructor() {
    super({
      name: VAR_METRICS_VARIABLE,
      label: 'Metrics',
      datasource: { uid: `\$${VAR_DATASOURCE}` },
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
