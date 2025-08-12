import { BusEventWithPayload } from '@grafana/data';

export interface EventRestorePanelConfigPayload {
  metric: string;
}

export class EventRestorePanelConfig extends BusEventWithPayload<EventRestorePanelConfigPayload> {
  public static readonly type = 'restore-default-panel-config';
}
