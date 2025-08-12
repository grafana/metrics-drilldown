import { BusEventWithPayload } from '@grafana/data';

export interface EventApplyPanelConfigPayload {
  metric: string;
}

export class EventApplyPanelConfig extends BusEventWithPayload<EventApplyPanelConfigPayload> {
  public static readonly type = 'apply-panel-config';
}
