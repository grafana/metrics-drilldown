import { BusEventWithPayload } from '@grafana/data';

import { type Metric } from '../matchers/getMetricType';

interface EventConfigurePanelPayload {
  metric: Metric;
}

export class EventConfigurePanel extends BusEventWithPayload<EventConfigurePanelPayload> {
  public static readonly type = 'configure-panel';
}
