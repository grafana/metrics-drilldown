import { BusEventWithPayload } from '@grafana/data';
import { type VariableValueOption } from '@grafana/scenes';

interface EventMetricsVariableLoadedPayload {
  key: string;
  options: VariableValueOption[];
}

export class EventMetricsVariableLoaded extends BusEventWithPayload<EventMetricsVariableLoadedPayload> {
  public static readonly type = 'metrics-variable-loaded';
}
