import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { HeatmapColorMode } from '@grafana/schema/dist/esm/raw/composable/heatmap/panelcfg/x/HeatmapPanelCfg_types.gen';

import { getUnit } from 'autoQuery/units';
import { trailDS } from 'shared';

import { type GmdVizPanelState } from '../GmdVizPanel';
import { getHeatmapQueryRunnerParams } from './getHeatmapQueryRunnerParams';

type HeatmapPanelOptions = Pick<
  GmdVizPanelState,
  'title' | 'metric' | 'matchers' | 'isNativeHistogram' | 'headerActions'
>;

export function buildHeatmapPanel(options: HeatmapPanelOptions): VizPanel {
  const { title, metric, matchers, isNativeHistogram, headerActions } = options;
  const queryParams = getHeatmapQueryRunnerParams(metric, matchers, Boolean(isNativeHistogram));
  const unit = getUnit(metric);

  const queryRunner = new SceneQueryRunner({
    datasource: trailDS,
    maxDataPoints: queryParams.maxDataPoints,
    queries: [
      {
        refId: metric,
        expr: queryParams.query,
        format: queryParams.format,
        fromExploreMetrics: true,
      },
    ],
  });

  return PanelBuilders.heatmap()
    .setTitle(title)
    .setDescription(isNativeHistogram ? 'Native Histogram' : '')
    .setHeaderActions(headerActions({ metric }))
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
    .build();
}
