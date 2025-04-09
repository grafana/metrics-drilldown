import { BusEventWithPayload } from '@grafana/data';

export interface EventMetricsVariableActivatedPayload {
  key: string;
}

export class EventMetricsVariableActivated extends BusEventWithPayload<EventMetricsVariableActivatedPayload> {
  public static type = 'metrics-variable-activated';
}
