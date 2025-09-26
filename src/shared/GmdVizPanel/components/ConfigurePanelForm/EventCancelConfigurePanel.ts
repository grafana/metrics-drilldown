import { BusEventWithPayload } from '@grafana/data';

import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';

interface EventCancelConfigurePanelPayload {
  metric: Metric;
}

export class EventCancelConfigurePanel extends BusEventWithPayload<EventCancelConfigurePanelPayload> {
  public static readonly type = 'cancel-configure-panel';
}
