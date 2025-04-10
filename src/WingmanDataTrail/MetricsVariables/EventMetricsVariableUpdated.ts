import { BusEventWithPayload } from '@grafana/data';
import { type VariableValueOption } from '@grafana/scenes';

export interface EventMetricsVariableUpdatedPayload {
  key: string;
  options: VariableValueOption[];
}

export class EventMetricsVariableUpdated extends BusEventWithPayload<EventMetricsVariableUpdatedPayload> {
  public static type = 'metrics-variable-updated';
}
