import { BusEventWithPayload } from '@grafana/data';

export interface EventApplyFunctionPayload {
  metricName: string;
  prometheusFunction: string;
}

export class EventApplyFunction extends BusEventWithPayload<EventApplyFunctionPayload> {
  public static type = 'apply-function';
}
