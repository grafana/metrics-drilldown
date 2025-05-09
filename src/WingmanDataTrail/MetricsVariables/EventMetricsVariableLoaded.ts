import { BusEventWithPayload } from '@grafana/data';
import { type VariableValueOption } from '@grafana/scenes';

export interface EventMetricsVariableLoadedPayload {
  key: string;
  options: VariableValueOption[];
}

export class EventMetricsVariableLoaded extends BusEventWithPayload<EventMetricsVariableLoadedPayload> {
  public static type = 'metrics-variable-loaded';
}
