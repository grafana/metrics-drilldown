import { BusEventWithPayload, type DataFrame } from '@grafana/data';

interface EventTimeseriesDataReceivedPayload {
  panelKey: string;
  series: DataFrame[];
}

export class EventTimeseriesDataReceived extends BusEventWithPayload<EventTimeseriesDataReceivedPayload> {
  public static readonly type = 'timeseries-data-received';
}
