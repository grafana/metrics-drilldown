import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import {
  HeatmapColorMode,
  type HeatmapLegend,
} from '@grafana/schema/dist/esm/raw/composable/heatmap/panelcfg/x/HeatmapPanelCfg_types.gen';

import { getUnit } from 'autoQuery/units';
import { trailDS } from 'shared';

import { type HistogramType, type PanelConfig, type QueryConfig } from '../GmdVizPanel';
import { getHeatmapQueryRunnerParams } from './getHeatmapQueryRunnerParams';

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

  const queryRunner = new SceneQueryRunner({
    datasource: trailDS,
    maxDataPoints: queryParams.maxDataPoints,
    queries: queryParams.queries,
  });

  return PanelBuilders.heatmap()
    .setTitle(panelConfig.title)
    .setDescription(panelConfig.description)
    .setHeaderActions(panelConfig.headerActions({ metric, panelConfig }))
    .setMenu(panelConfig.menu?.clone()) // we clone because it's already stored in GmdVizPanel
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
