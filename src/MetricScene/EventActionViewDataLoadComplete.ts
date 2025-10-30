import { BusEventWithPayload } from '@grafana/data';

import { type ActionViewType } from './MetricActionBar';

interface EventActionViewDataLoadCompletePayload {
  currentActionView: ActionViewType;
}

/**
 * Event published by Action View components (Breakdown, Related Metrics, Related Logs)
 * when their initial data loading is complete.
 *
 * This allows MetricScene to coordinate background counting for inactive tabs,
 * ensuring that the active tab's data fetching has priority.
 */
export class EventActionViewDataLoadComplete extends BusEventWithPayload<EventActionViewDataLoadCompletePayload> {
  public static readonly type = 'action-view-data-load-complete';
}
