import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import {
  HeatmapColorMode,
  type HeatmapLegend,
} from '@grafana/schema/dist/esm/raw/composable/heatmap/panelcfg/x/HeatmapPanelCfg_types.gen';

import { type HistogramType, type PanelConfig, type QueryConfig } from 'shared/GmdVizPanel/GmdVizPanel';
import { trailDS } from 'shared/shared';

import { getHeatmapQueryRunnerParams } from './getHeatmapQueryRunnerParams';
import { getUnit } from '../../units/getUnit';

type HeatmapPanelOptions = {
  metric: string;
  histogramType: HistogramType;
  panelConfig: PanelConfig;
  queryConfig: QueryConfig;
};

export function buildHeatmapPanel(options: HeatmapPanelOptions): VizPanel {
  const { metric, histogramType, panelConfig, queryConfig } = options;
  const queryParams = getHeatmapQueryRunnerParams({
    metric,
    isNativeHistogram: histogramType === 'native',
    queryConfig,
  });
  const unit = getUnit(metric);

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
    .setHeaderActions(panelConfig.headerActions({ metric, panelConfig }))
    .setMenu(panelConfig.menu?.({ metric, panelConfig }))
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
