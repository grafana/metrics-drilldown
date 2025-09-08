import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';

import { type PanelConfig, type QueryConfig } from 'GmdVizPanel/GmdVizPanel';
import { trailDS } from 'shared';
import { getColorByIndex } from 'utils';

import { getStatQueryRunnerParams } from './getStatQueryRunnerParams';
import { UP_DOWN_VALUE_MAPPINGS } from '../statushistory/value-mappings';

type StatushistoryPanelOptions = {
  metric: string;
  panelConfig: PanelConfig;
  queryConfig: QueryConfig;
};

export function buildStatPanel(options: StatushistoryPanelOptions): VizPanel {
  const { metric, panelConfig, queryConfig } = options;
  const queryParams = getStatQueryRunnerParams({ metric, queryConfig });
  const unit = 'none';

  const queryRunner =
    queryConfig.data ||
    new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: queryParams.maxDataPoints,
      queries: queryParams.queries,
    });

  return PanelBuilders.stat()
    .setTitle(panelConfig.title)
    .setDescription(panelConfig.description)
    .setHeaderActions(panelConfig.headerActions({ metric, panelConfig }))
    .setMenu(panelConfig.menu?.({ metric, panelConfig }))
    .setShowMenuAlways(Boolean(panelConfig.menu))
    .setData(queryRunner)
    .setUnit(unit)
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(panelConfig.fixedColorIndex || 0) })
    .setMappings(UP_DOWN_VALUE_MAPPINGS) // current support is only for up/down values
    .build();
}
