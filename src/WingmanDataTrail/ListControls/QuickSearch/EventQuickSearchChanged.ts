import { BusEventWithPayload } from '@grafana/data';

export interface EventQuickSearchChangedPayload {
  searchText: string;
}

export class EventQuickSearchChanged extends BusEventWithPayload<EventQuickSearchChangedPayload> {
  public static readonly type = 'quick-search-changed';
}
