import { BusEventWithPayload } from '@grafana/data';

import { type PanelDataRequestPayload } from './addToDashboard';

interface EventOpenAddToDashboardPayload {
  panelData: PanelDataRequestPayload;
}

export class EventOpenAddToDashboard extends BusEventWithPayload<EventOpenAddToDashboardPayload> {
  public static readonly type = 'open-add-to-dashboard';
}

export interface AddToDashboardComponentProps {
  onClose: () => void;
  panelData: PanelDataRequestPayload;
}

