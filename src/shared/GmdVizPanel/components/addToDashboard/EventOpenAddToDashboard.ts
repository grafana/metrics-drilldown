import { BusEventWithPayload, type TimeRange } from '@grafana/data';
import { type Panel } from '@grafana/schema';

import { type PanelDataRequestPayload } from './addToDashboard';

interface EventOpenAddToDashboardPayload {
  panelData: PanelDataRequestPayload;
}

export class EventOpenAddToDashboard extends BusEventWithPayload<EventOpenAddToDashboardPayload> {
  public static readonly type = 'open-add-to-dashboard';
}

export interface AddToDashboardFormProps {
  onClose: () => void;
  buildPanel: () => Panel;
  timeRange?: TimeRange;
  options?: { useAbsolutePath: boolean };
}
