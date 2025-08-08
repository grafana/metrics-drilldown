import { BusEventWithPayload } from '@grafana/data';

import { type PANEL_TYPE } from './GmdVizPanel';

export interface EventPanelTypeChangedPayload {
  panelType: PANEL_TYPE;
}

export class EventPanelTypeChanged extends BusEventWithPayload<EventPanelTypeChangedPayload> {
  public static readonly type = 'panel-type-changed';
}
