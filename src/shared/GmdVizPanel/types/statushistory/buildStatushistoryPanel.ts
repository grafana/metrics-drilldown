import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { VisibilityMode, type LegendPlacement } from '@grafana/schema';

import { trailDS } from 'shared/shared';

import { type BuildVizPanelOptions } from '../panelBuilder';
import { getStatushistoryQueryRunnerParams } from './getStatushistoryQueryRunnerParams';
import { UP_DOWN_VALUE_MAPPINGS } from './value-mappings';

export function buildStatushistoryPanel(options: BuildVizPanelOptions): VizPanel {
  const { metric, panelConfig, queryConfig } = options;
  const queryParams = getStatushistoryQueryRunnerParams({ metric, queryConfig });
  const unit = 'none';

  const queryRunner =
    queryConfig.data ||
    new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: queryParams.maxDataPoints,
      queries: queryParams.queries,
    });

  return (
    PanelBuilders.statushistory()
      .setTitle(panelConfig.title)
      .setDescription(panelConfig.description)
      .setHeaderActions(panelConfig.headerActions({ metric, panelConfig }))
      .setMenu(panelConfig.menu?.({ metric, panelConfig }))
      .setShowMenuAlways(Boolean(panelConfig.menu))
      .setData(queryRunner)
      .setUnit(unit)
      // Use value mappings for both color and text display
      .setColor({ mode: 'palette-classic' })
      .setOption('showValue', VisibilityMode.Never)
      .setOption('legend', panelConfig.legend || { showLegend: true, placement: 'bottom' as LegendPlacement })
      .setOption('perPage', 0) // hide pagination at the bottom of the panel
      .setMappings(UP_DOWN_VALUE_MAPPINGS) // current support is only for up/down values
      .build()
  );
}
