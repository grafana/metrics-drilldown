import { BusEventWithPayload } from '@grafana/data';

import { type PanelType } from 'GmdVizPanel/types/available-panel-types';

interface EventPanelTypeChangedPayload {
  panelType: PanelType;
}

export class EventPanelTypeChanged extends BusEventWithPayload<EventPanelTypeChangedPayload> {
  public static readonly type = 'panel-type-changed';
}
