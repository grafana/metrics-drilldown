import { BusEventWithPayload } from '@grafana/data';

import { type PanelConfigPreset } from 'shared/GmdVizPanel/config/presets/types';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';

interface EventApplyPanelConfigPayload {
  metric: Metric;
  config: PanelConfigPreset;
  restoreDefault?: boolean;
}

export class EventApplyPanelConfig extends BusEventWithPayload<EventApplyPanelConfigPayload> {
  public static readonly type = 'apply-panel-config';
}
