import { type ValueMapping } from '@grafana/data';
import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { MappingType, VisibilityMode } from '@grafana/schema';

import { type LabelMatcher } from 'GmdVizPanel/buildQueryExpression';
import { trailDS } from 'shared';
import { SelectAction } from 'WingmanDataTrail/MetricVizPanel/actions/SelectAction';

import { getStatushistoryQueryRunnerParams } from './getStatushistoryQueryRunnerParams';

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

type StatusHistoryPanelOptions = {
  metric: string;
  matchers: LabelMatcher[];
};

export function buildStatushistoryPanel(options: StatusHistoryPanelOptions): VizPanel {
  const { metric, matchers } = options;
  const query = getStatushistoryQueryRunnerParams(metric, matchers);
  const unit = 'none';

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
      .setTitle(metric)
      .setHeaderActions([new SelectAction({ metricName: metric })])
      .setData(queryRunner)
      .setUnit(unit)
      // Use value mappings for both color and text display
      .setColor({ mode: 'palette-classic' })
      .setMappings(mappings)
      .setDisplayName('status')
      .setOption('showValue', VisibilityMode.Never)
      .setOption('legend', { showLegend: true })
      .setOption('perPage', 0) // hide pagination at the bottom of the panel
      .build()
  );
}
