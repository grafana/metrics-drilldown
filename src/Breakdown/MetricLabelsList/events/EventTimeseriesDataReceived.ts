import { BusEventWithPayload, type DataFrame } from '@grafana/data';

interface EventTimeseriesDataReceivedPayload {
  series?: DataFrame[];
  forceYAxisUpdate?: boolean;
  sourcePanelKey?: string;
}

export class EventTimeseriesDataReceived extends BusEventWithPayload<EventTimeseriesDataReceivedPayload> {
  public static readonly type = 'timeseries-data-received';
}
