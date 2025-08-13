import { BusEventWithPayload } from '@grafana/data';

import { type PanelConfigPreset } from 'GmdVizPanel/config/config-presets';

export interface EventApplyPanelConfigPayload {
  metric: string;
  config: PanelConfigPreset;
  restoreDefault?: boolean;
}

export class EventApplyPanelConfig extends BusEventWithPayload<EventApplyPanelConfigPayload> {
  public static readonly type = 'apply-panel-config';
}
