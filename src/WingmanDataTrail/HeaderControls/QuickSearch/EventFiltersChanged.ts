import { BusEventWithPayload } from '@grafana/data';

export interface EventFiltersChangedPayload {
  filters: string[];
  type: 'prefixes' | 'categories' | 'suffixes';
}

export class EventFiltersChanged extends BusEventWithPayload<EventFiltersChangedPayload> {
  public static type = 'filters-changed';
}
