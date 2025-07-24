import { BusEventWithPayload } from '@grafana/data';

interface EventForceSyncYAxisPayload {}

export class EventForceSyncYAxis extends BusEventWithPayload<EventForceSyncYAxisPayload> {
  public static readonly type = 'force-sync-y-axis';
}
