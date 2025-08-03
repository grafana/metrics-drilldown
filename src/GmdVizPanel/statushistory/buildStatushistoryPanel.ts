import { type ValueMapping } from '@grafana/data';
import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { MappingType, VisibilityMode } from '@grafana/schema';

import { trailDS } from 'shared';

import { type GmdVizPanelState } from '../GmdVizPanel';
import { getStatushistoryQueryRunnerParams } from './getStatushistoryQueryRunnerParams';

const mappings: ValueMapping[] = [
  {
    type: MappingType.ValueToText,
    options: {
      '0': {
        color: 'red',
        text: 'down',
      },
      '1': {
        color: 'green',
        text: 'up',
      },
    },
  },
];

type StatusHistoryPanelOptions = Pick<GmdVizPanelState, 'title' | 'metric' | 'matchers' | 'headerActions'>;

export function buildStatushistoryPanel(options: StatusHistoryPanelOptions): VizPanel {
  const { title, metric, matchers, headerActions } = options;
  const queryParams = getStatushistoryQueryRunnerParams(metric, matchers);
  const unit = 'none';

  const queryRunner = new SceneQueryRunner({
    datasource: trailDS,
    maxDataPoints: queryParams.maxDataPoints,
    queries: [
      {
        refId: metric,
        expr: queryParams.query,
        fromExploreMetrics: true,
      },
    ],
  });

  return (
    PanelBuilders.statushistory()
      .setTitle(title)
      .setHeaderActions(headerActions({ metric }))
      .setData(queryRunner)
      .setUnit(unit)
      // Use value mappings for both color and text display
      .setColor({ mode: 'palette-classic' })
      .setMappings(mappings)
      .setDisplayName('status')
      .setOption('showValue', VisibilityMode.Never)
      .setOption('legend', { showLegend: true })
      .setOption('perPage', 0) // hide pagination at the bottom of the panel
      .build()
  );
}
