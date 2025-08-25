import { BusEventWithPayload } from '@grafana/data';

interface EventConfigurePanelPayload {
  metric: string;
}

export class EventConfigurePanel extends BusEventWithPayload<EventConfigurePanelPayload> {
  public static readonly type = 'configure-panel';
}
