import { MetricsVariable } from './MetricsVariable';
import { withLifecycleEvents } from './withLifecycleEvents';

export const VAR_FILTERED_METRICS_VARIABLE = 'filtered-metrics-wingman';

export class FilteredMetricsVariable extends MetricsVariable {
  constructor() {
    super({
      key: VAR_FILTERED_METRICS_VARIABLE,
      name: VAR_FILTERED_METRICS_VARIABLE,
      label: 'Filtered Metrics',
    });

    // required for filtering and sorting
    return withLifecycleEvents<FilteredMetricsVariable>(this);
  }
}
