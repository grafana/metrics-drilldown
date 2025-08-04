import { type ValueMapping } from '@grafana/data';
import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { MappingType, VisibilityMode } from '@grafana/schema';

import { trailDS } from 'shared';

import { PANEL_TYPE, type GmdVizPanelState } from '../GmdVizPanel';
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

export type StatushistoryPanelOptions = Pick<
  GmdVizPanelState,
  'title' | 'description' | 'metric' | 'matchers' | 'headerActions' | 'menu' | 'queryResolution'
>;

export function buildStatushistoryPanel(options: StatushistoryPanelOptions): VizPanel {
  const { title, description, metric, matchers, headerActions, menu, queryResolution } = options;
  const queryParams = getStatushistoryQueryRunnerParams({ metric, matchers, queryResolution });
  const unit = 'none';

  const queryRunner = new SceneQueryRunner({
    datasource: trailDS,
    maxDataPoints: queryParams.maxDataPoints,
    queries: queryParams.queries,
  });

  return (
    PanelBuilders.statushistory()
      .setTitle(title)
      .setDescription(description)
      .setHeaderActions(headerActions({ metric, panelType: PANEL_TYPE.STATUSHISTORY }))
      .setMenu(menu?.clone()) // we clone because it's already stored in GmdVizPanel
      .setShowMenuAlways(Boolean(menu))
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
