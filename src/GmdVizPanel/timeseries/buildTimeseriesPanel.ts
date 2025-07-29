import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';

import { type PanelBuilderOptions } from 'GmdVizPanel/getPanelBuilderOptions';
import { trailDS } from 'shared';
import { SelectAction } from 'WingmanDataTrail/MetricVizPanel/actions/SelectAction';

export function buildTimeseriesPanel(options: PanelBuilderOptions): VizPanel {
  const { query, unit, fixedColor } = options.default;

  const queryRunner = new SceneQueryRunner({
    datasource: trailDS,
    maxDataPoints: query.maxDataPoints,
    queries: [
      {
        refId: options.metric,
        expr: query.query,
        fromExploreMetrics: true,
      },
    ],
  });

  return PanelBuilders.timeseries()
    .setTitle(options.metric)
    .setHeaderActions([new SelectAction({ metricName: options.metric })])
    .setData(queryRunner)
    .setUnit(unit)
    .setColor({ mode: 'fixed', fixedColor })
    .setCustomFieldConfig('fillOpacity', 9)
    .setCustomFieldConfig('pointSize', 1)
    .setDisplayName(query.fnName)
    .build();
}
