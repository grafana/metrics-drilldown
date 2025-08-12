import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';

import { trailDS } from 'shared';
import { getColorByIndex } from 'utils';

import { type PanelConfig, type QueryConfig } from '../GmdVizPanel';
import { getStatQueryRunnerParams } from './getStatQueryRunnerParams';

type StatushistoryPanelOptions = {
  metric: string;
  panelConfig: PanelConfig;
  queryConfig: QueryConfig;
};

export function buildStatPanel(options: StatushistoryPanelOptions): VizPanel {
  const { metric, panelConfig, queryConfig } = options;
  const queryParams = getStatQueryRunnerParams({ metric, queryConfig });
  const unit = 'none';

  const queryRunner = new SceneQueryRunner({
    datasource: trailDS,
    maxDataPoints: queryParams.maxDataPoints,
    queries: queryParams.queries,
  });

  return PanelBuilders.stat()
    .setTitle(panelConfig.title)
    .setDescription(panelConfig.description)
    .setHeaderActions(panelConfig.headerActions({ metric, panelConfig }))
    .setMenu(panelConfig.menu?.clone()) // we clone because it's already stored in GmdVizPanel
    .setShowMenuAlways(Boolean(panelConfig.menu))
    .setData(queryRunner)
    .setUnit(unit)
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(panelConfig.fixedColorIndex || 0) })
    .setMappings(panelConfig?.mappings)
    .build();
}
