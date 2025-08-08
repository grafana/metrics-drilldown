import { PanelBuilders, SceneQueryRunner } from '@grafana/scenes';
import { SortOrder, TooltipDisplayMode, type LegendPlacement } from '@grafana/schema';

import { getPerSecondRateUnit, getUnit } from 'autoQuery/units';
import { PANEL_TYPE, type GmdVizPanelState } from 'GmdVizPanel/GmdVizPanel';
import { trailDS } from 'shared';

import { getPercentilesQueryRunnerParams } from './getPercentilesQueryRunnerParams';

export type PercentilesPanelOptions = Pick<
  GmdVizPanelState,
  'isNativeHistogram' | 'title' | 'description' | 'metric' | 'matchers' | 'headerActions' | 'menu' | 'queryResolution'
>;

export function buildPercentilesPanel(options: PercentilesPanelOptions) {
  const { title, description, metric, matchers, headerActions, menu, isNativeHistogram, queryResolution } = options;
  const queryParams = getPercentilesQueryRunnerParams({
    metric,
    matchers,
    isNativeHistogram: Boolean(isNativeHistogram),
    queryResolution,
    addIgnoreUsageFilter: true,
  });
  const unit = queryParams.isRateQuery ? getPerSecondRateUnit(metric) : getUnit(metric);

  const $data = new SceneQueryRunner({
    datasource: trailDS,
    maxDataPoints: queryParams.maxDataPoints,
    queries: queryParams.queries,
  });

  return PanelBuilders.timeseries()
    .setTitle(title)
    .setDescription(description)
    .setHeaderActions(headerActions({ metric, panelType: PANEL_TYPE.PERCENTILES }))
    .setMenu(menu?.clone()) // we clone because it's already stored in GmdVizPanel
    .setShowMenuAlways(Boolean(menu))
    .setData($data)
    .setUnit(unit)
    .setOption('legend', { showLegend: true, placement: 'right' as LegendPlacement })
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
    .setCustomFieldConfig('fillOpacity', 9)
    .build();
}
