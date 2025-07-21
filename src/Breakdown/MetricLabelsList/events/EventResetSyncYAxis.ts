import { BusEventWithPayload } from '@grafana/data';

interface EventTimeseriesDataReceivedPayload {}

export class EventResetSyncYAxis extends BusEventWithPayload<EventTimeseriesDataReceivedPayload> {
  public static readonly type = 'reset-sync-y-axis';
}
