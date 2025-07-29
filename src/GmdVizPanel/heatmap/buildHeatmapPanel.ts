import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { HeatmapColorMode } from '@grafana/schema/dist/esm/raw/composable/heatmap/panelcfg/x/HeatmapPanelCfg_types.gen';

import { type PanelBuilderOptions } from 'GmdVizPanel/getPanelBuilderOptions';
import { trailDS } from 'shared';
import { SelectAction } from 'WingmanDataTrail/MetricVizPanel/actions/SelectAction';

export function buildHeatmapPanel(options: PanelBuilderOptions): VizPanel {
  const { query, unit } = options.default;

  const queryRunner = new SceneQueryRunner({
    datasource: trailDS,
    maxDataPoints: query.maxDataPoints,
    queries: [
      {
        refId: options.metric,
        expr: query.query,
        format: query.format,
        fromExploreMetrics: true,
      },
    ],
  });

  return PanelBuilders.heatmap()
    .setTitle(options.metric)
    .setDescription(options.isNativeHistogram ? 'Native Histogram' : '')
    .setHeaderActions([new SelectAction({ metricName: options.metric })])
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
