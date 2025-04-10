import { BusEventWithPayload } from '@grafana/data';

export interface EventMetricsVariableUpdatedPayload {
  key: string;
}

export class EventMetricsVariableUpdated extends BusEventWithPayload<EventMetricsVariableUpdatedPayload> {
  public static type = 'metrics-variable-updated';
}
