import { PANEL_HEIGHT } from 'shared/GmdVizPanel/config/panel-heights';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { type PanelConfig } from 'shared/GmdVizPanel/GmdVizPanel';

import { buildHeatmapPanel } from '../buildHeatmapPanel';

describe('buildHeatmapPanel', () => {
  it('uses the bucket value unit for duration histogram boundaries', () => {
    const panel = buildHeatmapPanel({
      metric: { name: 'rpc_server_duration_milliseconds_bucket', type: 'classic-histogram' },
      panelConfig: {
        type: 'heatmap',
        title: 'Heatmap',
        height: PANEL_HEIGHT.M,
        headerActions: () => [],
      } as PanelConfig,
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [],
        addIgnoreUsageFilter: false,
      },
    });

    expect((panel.state.options as { yAxis?: { unit?: string } }).yAxis?.unit).toBe('ms');
    expect(panel.state.fieldConfig.defaults.unit).toBe('ms');
  });
});
