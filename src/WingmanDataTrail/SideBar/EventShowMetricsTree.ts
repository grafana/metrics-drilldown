import { BusEventWithPayload } from '@grafana/data';

export interface EventShowMetricsTreePayload {}

export class EventShowMetricsTree extends BusEventWithPayload<EventShowMetricsTreePayload> {
  public static type = 'show-metrics-tree';
}
