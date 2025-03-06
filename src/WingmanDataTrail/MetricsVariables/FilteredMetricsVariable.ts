import { MetricsVariable } from './MetricsVariable';

export const VAR_FILTERED_METRICS_VARIABLE = 'filtered-metrics-wingman';

export type MetricOptions = Array<{ label: string; value: string }>;

export class FilteredMetricsVariable extends MetricsVariable {
  constructor() {
    super({
      name: VAR_FILTERED_METRICS_VARIABLE,
      label: 'Filtered Metrics',
    });
  }
}
