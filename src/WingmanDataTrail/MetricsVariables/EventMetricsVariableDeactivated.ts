import { BusEventWithPayload } from '@grafana/data';

export interface EventMetricsVariableDeactivatedPayload {
  key: string;
}

export class EventMetricsVariableDeactivated extends BusEventWithPayload<EventMetricsVariableDeactivatedPayload> {
  public static readonly type = 'metrics-variable-deactivated';
}
