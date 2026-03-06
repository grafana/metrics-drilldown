import { PanelBuilders, SceneDataTransformer, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import {
  HeatmapColorMode,
  type HeatmapLegend,
} from '@grafana/schema/dist/esm/raw/composable/heatmap/panelcfg/x/HeatmapPanelCfg_types.gen';

import { trailDS } from 'shared/shared';

import { getHeatmapQueryRunnerParams } from './getHeatmapQueryRunnerParams';
import { filterEmptyFrames } from './transformations/filterEmptyFrames';
import { getUnit } from '../../units/getUnit';
import { type BuildVizPanelOptions } from '../panelBuilder';

export function buildHeatmapPanel(options: BuildVizPanelOptions): VizPanel {
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

  const $data = new SceneDataTransformer({
    $data: queryRunner,
    transformations: [filterEmptyFrames],
  });

  return PanelBuilders.heatmap()
    .setTitle(panelConfig.title)
    .setDescription(panelConfig.description)
    .setHeaderActions(panelConfig.headerActions({ metric, panelConfig }))
    .setMenu(panelConfig.menu?.({ metric, panelConfig }))
    .setShowMenuAlways(Boolean(panelConfig.menu))
    .setData($data)
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
