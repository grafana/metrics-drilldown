import { BusEventWithPayload } from '@grafana/data';

export interface EventRestoreDefaultConfigPayload {
  metric: string;
}

export class EventRestoreDefaultConfig extends BusEventWithPayload<EventRestoreDefaultConfigPayload> {
  public static readonly type = 'restore-default-panel-config';
}
