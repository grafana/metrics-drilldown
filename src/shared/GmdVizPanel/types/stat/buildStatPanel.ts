import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';

import { type PanelConfig, type QueryConfig } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';
import { trailDS } from 'shared/shared';
import { getColorByIndex } from 'shared/utils/utils';

import { getStatQueryRunnerParams } from './getStatQueryRunnerParams';
import { UP_DOWN_VALUE_MAPPINGS } from '../statushistory/value-mappings';

type StatushistoryPanelOptions = {
  metric: Metric;
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
    .setHeaderActions(panelConfig.headerActions({ metric: metric.name, panelConfig }))
    .setMenu(panelConfig.menu?.({ metric: metric.name, panelConfig }))
    .setShowMenuAlways(Boolean(panelConfig.menu))
    .setData(queryRunner)
    .setUnit(unit)
    .setColor({ mode: 'fixed', fixedColor: getColorByIndex(panelConfig.fixedColorIndex || 0) })
    .setMappings(UP_DOWN_VALUE_MAPPINGS) // current support is only for up/down values
    .build();
}
