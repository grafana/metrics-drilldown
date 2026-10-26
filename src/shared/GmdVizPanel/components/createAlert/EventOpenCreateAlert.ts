import { BusEventWithPayload } from '@grafana/data';

import { type PanelDataRequestPayload } from '../addToDashboard/addToDashboard';

interface EventOpenCreateAlertPayload {
  panelData: PanelDataRequestPayload;
}

export class EventOpenCreateAlert extends BusEventWithPayload<EventOpenCreateAlertPayload> {
  public static readonly type = 'open-create-alert';
}
