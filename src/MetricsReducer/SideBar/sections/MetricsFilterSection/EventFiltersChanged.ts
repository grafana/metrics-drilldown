import { BusEventWithPayload } from '@grafana/data';

import { type MetricFilters } from 'MetricsReducer/metrics-variables/MetricsVariableFilterEngine';

interface EventFiltersChangedPayload {
  type: keyof MetricFilters;
  filters: string[];
}

export class EventFiltersChanged extends BusEventWithPayload<EventFiltersChangedPayload> {
  public static readonly type = 'filters-changed';
}
