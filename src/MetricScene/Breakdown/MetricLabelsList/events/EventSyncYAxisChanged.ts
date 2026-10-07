import { BusEventWithPayload } from '@grafana/data';

interface EventSyncYAxisChangedPayload {
  enabled: boolean;
}

export class EventSyncYAxisChanged extends BusEventWithPayload<EventSyncYAxisChangedPayload> {
  public static readonly type = 'sync-y-axis-changed';
}
