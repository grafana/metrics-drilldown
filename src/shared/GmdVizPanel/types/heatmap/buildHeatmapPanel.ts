import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import {
  HeatmapColorMode,
  type HeatmapLegend,
} from '@grafana/schema/dist/esm/raw/composable/heatmap/panelcfg/x/HeatmapPanelCfg_types.gen';

import { type PanelConfig, type QueryConfig } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';
import { trailDS } from 'shared/shared';

import { getHeatmapQueryRunnerParams } from './getHeatmapQueryRunnerParams';
import { getUnit } from '../../units/getUnit';

type HeatmapPanelOptions = {
  metric: Metric;
  panelConfig: PanelConfig;
  queryConfig: QueryConfig;
};

export function buildHeatmapPanel(options: HeatmapPanelOptions): VizPanel {
  const { metric, panelConfig, queryConfig } = options;
  const queryParams = getHeatmapQueryRunnerParams({
    metric,
    queryConfig,
  });
  const unit = getUnit(metric.name);

  const queryRunner =
    queryConfig.data ||
    new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: queryParams.maxDataPoints,
      queries: queryParams.queries,
    });

  return PanelBuilders.heatmap()
    .setTitle(panelConfig.title)
    .setDescription(panelConfig.description)
    .setHeaderActions(panelConfig.headerActions({ metric: metric.name, panelConfig }))
    .setMenu(panelConfig.menu?.({ metric: metric.name, panelConfig }))
    .setShowMenuAlways(Boolean(panelConfig.menu))
    .setData(queryRunner)
    .setUnit(unit)
    .setOption('calculate', false)
    .setOption('color', {
      mode: HeatmapColorMode.Scheme,
      exponent: 0.5,
      scheme: 'Spectral',
      steps: 32,
      reverse: false,
    })
    .setOption('legend', panelConfig.legend as HeatmapLegend)
    .build();
}
