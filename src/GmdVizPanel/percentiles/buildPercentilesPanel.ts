import { PanelBuilders, SceneQueryRunner } from '@grafana/scenes';
import { type LegendPlacement } from '@grafana/schema';

import { getPerSecondRateUnit, getUnit } from 'autoQuery/units';
import { type GmdVizPanelState } from 'GmdVizPanel/GmdVizPanel';
import { trailDS } from 'shared';

import { getPercentilesQueryRunnerParams } from './getPercentilesQueryRunnerParams';

type PercentilesPanelOptions = Pick<
  GmdVizPanelState,
  'isNativeHistogram' | 'title' | 'description' | 'metric' | 'matchers' | 'headerActions' | 'menu'
>;

export function buildPercentilesPanel(options: PercentilesPanelOptions) {
  const { title, description, metric, matchers, headerActions, menu, isNativeHistogram } = options;
  const queryParams = getPercentilesQueryRunnerParams(metric, matchers, Boolean(isNativeHistogram));
  const unit = queryParams.isRateQuery ? getPerSecondRateUnit(metric) : getUnit(metric);

  const $data = new SceneQueryRunner({
    datasource: trailDS,
    maxDataPoints: queryParams.maxDataPoints,
    queries: queryParams.queries,
  });

  return PanelBuilders.timeseries()
    .setTitle(title)
    .setDescription(description)
    .setHeaderActions(headerActions({ metric }))
    .setMenu(menu?.clone()) // we clone because it's already stored in GmdVizPanel
    .setShowMenuAlways(Boolean(menu))
    .setData($data)
    .setOption('legend', { showLegend: true, placement: 'right' as LegendPlacement })
    .setUnit(unit)
    .setCustomFieldConfig('fillOpacity', 9)
    .build();
}
