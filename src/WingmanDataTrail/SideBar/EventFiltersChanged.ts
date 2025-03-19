import { BusEventWithPayload } from '@grafana/data';

export interface EventFiltersChangedPayload {
  type: 'prefixes' | 'categories';
  filters: string[];
}

export class EventFiltersChanged extends BusEventWithPayload<EventFiltersChangedPayload> {
  public static type = 'filters-changed';
}
