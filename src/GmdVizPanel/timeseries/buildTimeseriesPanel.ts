import { PanelBuilders, SceneQueryRunner, type VizPanel } from '@grafana/scenes';

import { getPerSecondRateUnit, getUnit } from 'autoQuery/units';
import { trailDS } from 'shared';
import { SelectAction } from 'WingmanDataTrail/MetricVizPanel/actions/SelectAction';

import { getTimeseriesQueryRunnerParams } from './getTimeseriesQueryRunnerParams';
import { type LabelMatcher } from '../buildQueryExpression';

type TimeseriesPanelOptions = {
  metric: string;
  matchers: LabelMatcher[];
  fixedColor: string;
};

export function buildTimeseriesPanel(options: TimeseriesPanelOptions): VizPanel {
  const { metric, matchers, fixedColor } = options;
  const queryParams = getTimeseriesQueryRunnerParams(metric, matchers);
  const unit = queryParams.isRateQuery ? getPerSecondRateUnit(metric) : getUnit(metric);

  const queryRunner = new SceneQueryRunner({
    datasource: trailDS,
    maxDataPoints: queryParams.maxDataPoints,
    queries: [
      {
        refId: options.metric,
        expr: queryParams.query,
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
    .setDisplayName(queryParams.fnName)
    .build();
}
