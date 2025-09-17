import { BusEventWithPayload } from '@grafana/data';

interface EventCancelConfigurePanelPayload {
  metric: string;
}

export class EventCancelConfigurePanel extends BusEventWithPayload<EventCancelConfigurePanelPayload> {
  public static readonly type = 'cancel-configure-panel';
}
