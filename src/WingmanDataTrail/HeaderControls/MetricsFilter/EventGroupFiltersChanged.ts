import { BusEventWithPayload } from '@grafana/data';

export interface EventGroupFiltersChangedPayload {
  type: string;
  groups: string[];
}

export class EventGroupFiltersChanged extends BusEventWithPayload<EventGroupFiltersChangedPayload> {
  public static type = 'group-filters-changed';
}
