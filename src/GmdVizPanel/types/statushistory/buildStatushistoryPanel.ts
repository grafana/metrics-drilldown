import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { VisibilityMode, type VizLegendOptions } from '@grafana/schema';

import { type PanelConfig, type QueryConfig } from 'GmdVizPanel/GmdVizPanel';
import { trailDS } from 'shared';

import { getStatushistoryQueryRunnerParams } from './getStatushistoryQueryRunnerParams';

type StatushistoryPanelOptions = {
  metric: string;
  panelConfig: PanelConfig;
  queryConfig: QueryConfig;
};

export function buildStatushistoryPanel(options: StatushistoryPanelOptions): VizPanel {
  const { metric, panelConfig, queryConfig } = options;
  const queryParams = getStatushistoryQueryRunnerParams({ metric, queryConfig });
  const unit = 'none';

  const queryRunner = new SceneQueryRunner({
    datasource: trailDS,
    maxDataPoints: queryParams.maxDataPoints,
    queries: queryParams.queries,
  });

  return (
    PanelBuilders.statushistory()
      .setTitle(panelConfig.title)
      .setDescription(panelConfig.description)
      .setHeaderActions(panelConfig.headerActions({ metric, panelConfig }))
      .setMenu(panelConfig.menu?.clone()) // we clone because it's already stored in GmdVizPanel
      .setShowMenuAlways(Boolean(panelConfig.menu))
      .setData(queryRunner)
      .setUnit(unit)
      // Use value mappings for both color and text display
      .setColor({ mode: 'palette-classic' })
      .setMappings(panelConfig.mappings)
      .setOption('showValue', VisibilityMode.Never)
      .setOption('legend', panelConfig.legend as VizLegendOptions)
      .setOption('perPage', 0) // hide pagination at the bottom of the panel
      .build()
  );
}
