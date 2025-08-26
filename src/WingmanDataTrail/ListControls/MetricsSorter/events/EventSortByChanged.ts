import { BusEventWithPayload } from '@grafana/data';

import { type SortingOption } from '../MetricsSorter';

interface EventSortByChangedPayload {
  sortBy: SortingOption;
}

export class EventSortByChanged extends BusEventWithPayload<EventSortByChangedPayload> {
  public static readonly type = 'sort-by-changed';
}
