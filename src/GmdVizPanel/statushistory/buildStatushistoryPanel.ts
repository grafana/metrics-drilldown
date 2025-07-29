import { type ValueMapping } from '@grafana/data';
import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { MappingType, VisibilityMode } from '@grafana/schema';

import { type PanelBuilderOptions } from 'GmdVizPanel/getPanelBuilderOptions';
import { trailDS } from 'shared';
import { SelectAction } from 'WingmanDataTrail/MetricVizPanel/actions/SelectAction';

const mappings: ValueMapping[] = [
  {
    type: MappingType.ValueToText,
    options: {
      '0': {
        color: 'red',
        text: 'down',
      },
      '1': {
        color: 'green',
        text: 'up',
      },
    },
  },
];

export function buildStatushistoryPanel(options: PanelBuilderOptions): VizPanel {
  const { query, unit } = options.default;

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

  return (
    PanelBuilders.statushistory()
      .setTitle(options.metric)
      .setHeaderActions([new SelectAction({ metricName: options.metric })])
      .setData(queryRunner)
      .setUnit(unit)
      // Use value mappings for both color and text display
      .setColor({ mode: 'palette-classic' })
      .setMappings(mappings)
      .setDisplayName('status')
      .setOption('showValue', VisibilityMode.Never)
      .setOption('legend', { showLegend: true })
      .setOption('perPage', 0) // hide pagination below the panel
      .build()
  );
}
