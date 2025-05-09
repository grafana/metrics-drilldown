import { BusEventWithPayload } from '@grafana/data';

import { type MetricFilters } from 'WingmanDataTrail/MetricsVariables/MetricsVariableFilterEngine';

export interface EventFiltersChangedPayload {
  type: keyof MetricFilters;
  filters: string[];
}

export class EventFiltersChanged extends BusEventWithPayload<EventFiltersChangedPayload> {
  public static readonly type = 'filters-changed';
}
