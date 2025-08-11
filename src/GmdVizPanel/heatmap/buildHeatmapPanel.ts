import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { HeatmapColorMode } from '@grafana/schema/dist/esm/raw/composable/heatmap/panelcfg/x/HeatmapPanelCfg_types.gen';

import { getUnit } from 'autoQuery/units';
import { trailDS } from 'shared';

import { PANEL_TYPE, type GmdVizPanelState } from '../GmdVizPanel';
import { getHeatmapQueryRunnerParams } from './getHeatmapQueryRunnerParams';

export type HeatmapPanelOptions = Pick<
  GmdVizPanelState,
  'isNativeHistogram' | 'title' | 'description' | 'metric' | 'matchers' | 'headerActions' | 'menu' | 'queryResolution'
>;

export function buildHeatmapPanel(options: HeatmapPanelOptions): VizPanel {
  const { title, description, metric, matchers, isNativeHistogram, headerActions, menu, queryResolution } = options;
  const queryParams = getHeatmapQueryRunnerParams({
    metric,
    matchers,
    isNativeHistogram: Boolean(isNativeHistogram),
    queryResolution,
    addIgnoreUsageFilter: true,
  });
  const unit = getUnit(metric);

  const queryRunner = new SceneQueryRunner({
    datasource: trailDS,
    maxDataPoints: queryParams.maxDataPoints,
    queries: queryParams.queries,
  });

  return PanelBuilders.heatmap()
    .setTitle(title)
    .setDescription(isNativeHistogram ? 'Native Histogram' : description)
    .setHeaderActions(headerActions({ metric, panelType: PANEL_TYPE.HEATMAP }))
    .setMenu(menu?.clone()) // we clone because it's already stored in GmdVizPanel
    .setShowMenuAlways(Boolean(menu))
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
