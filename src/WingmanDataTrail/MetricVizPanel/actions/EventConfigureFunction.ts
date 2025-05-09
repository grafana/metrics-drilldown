import { BusEventWithPayload } from '@grafana/data';

export interface EventConfigureFunctionPayload {
  metricName: string;
}

export class EventConfigureFunction extends BusEventWithPayload<EventConfigureFunctionPayload> {
  public static readonly type = 'configure-function';
}
