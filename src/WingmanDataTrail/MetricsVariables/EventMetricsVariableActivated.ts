import { BusEventWithPayload } from '@grafana/data';

interface EventMetricsVariableActivatedPayload {
  key: string;
}

export class EventMetricsVariableActivated extends BusEventWithPayload<EventMetricsVariableActivatedPayload> {
  public static readonly type = 'metrics-variable-activated';
}
