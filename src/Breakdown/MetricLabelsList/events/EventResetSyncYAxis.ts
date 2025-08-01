import { BusEventWithPayload } from '@grafana/data';

interface EventResetSyncYAxisPayload {}

export class EventResetSyncYAxis extends BusEventWithPayload<EventResetSyncYAxisPayload> {
  public static readonly type = 'reset-sync-y-axis';
}
