import { PANEL_HEIGHT } from 'shared/GmdVizPanel/config/panel-heights';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { type PanelConfig } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';

import { buildPercentilesPanel } from '../buildPercentilesPanel';

function buildPanel(metric: Metric) {
  return buildPercentilesPanel({
    metric,
    panelConfig: {
      type: 'percentiles',
      title: 'Percentiles',
      height: PANEL_HEIGHT.M,
      headerActions: () => [],
    } as PanelConfig,
    queryConfig: {
      resolution: QUERY_RESOLUTION.MEDIUM,
      labelMatchers: [],
      addIgnoreUsageFilter: false,
    },
  });
}

describe('buildPercentilesPanel', () => {
  it('uses the bucket value unit for histogram percentiles', () => {
    const panel = buildPanel({ name: 'rpc_server_duration_milliseconds_bucket', type: 'classic-histogram' });

    expect(panel.state.fieldConfig.defaults.unit).toBe('ms');
  });

  it('keeps rate units for counter percentiles', () => {
    const panel = buildPanel({ name: 'request_size_bytes_total', type: 'counter' });

    expect(panel.state.fieldConfig.defaults.unit).toBe('Bps');
  });
});
