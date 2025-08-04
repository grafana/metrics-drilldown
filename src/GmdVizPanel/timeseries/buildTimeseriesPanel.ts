import { PanelBuilders, SceneDataTransformer, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { SortOrder, TooltipDisplayMode, type LegendPlacement } from '@grafana/schema';

import { getPerSecondRateUnit, getUnit } from 'autoQuery/units';
import { addUnspecifiedLabel } from 'Breakdown/MetricLabelsList/transformations/addUnspecifiedLabel';
import { trailDS } from 'shared';

import { type GmdVizPanelState } from '../GmdVizPanel';
import { getTimeseriesQueryRunnerParams } from './getTimeseriesQueryRunnerParams';

type TimeseriesPanelOptions = Pick<
  GmdVizPanelState,
  'fixedColor' | 'groupBy' | 'title' | 'description' | 'metric' | 'matchers' | 'headerActions' | 'menu'
>;

export function buildTimeseriesPanel(options: TimeseriesPanelOptions): VizPanel {
  if (options.groupBy) {
    return buildGroupByPanel(options as Required<TimeseriesPanelOptions>);
  }

  const { title, description, metric, matchers, fixedColor, headerActions, groupBy, menu } = options;
  const queryParams = getTimeseriesQueryRunnerParams(metric, matchers, groupBy);
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
    .setOption('legend', { showLegend: true, placement: 'bottom' as LegendPlacement })
    .setUnit(unit)
    .setColor(fixedColor ? { mode: 'fixed', fixedColor } : undefined)
    .setCustomFieldConfig('fillOpacity', 9)
    .setDisplayName(queryParams.fnName)
    .build();
}

function buildGroupByPanel(options: Required<TimeseriesPanelOptions>): VizPanel {
  const { title, description, metric, matchers, fixedColor, headerActions, menu, groupBy } = options;
  const queryParams = getTimeseriesQueryRunnerParams(metric, matchers, groupBy);
  const unit = queryParams.isRateQuery ? getPerSecondRateUnit(metric) : getUnit(metric);

  const $data = new SceneDataTransformer({
    $data: new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: queryParams.maxDataPoints,
      queries: queryParams.queries,
    }),
    transformations: [addUnspecifiedLabel(groupBy)],
  });

  return PanelBuilders.timeseries()
    .setTitle(title)
    .setDescription(description)
    .setHeaderActions(headerActions({ metric }))
    .setMenu(menu?.clone()) // we clone because it's already stored in GmdVizPanel
    .setShowMenuAlways(Boolean(menu))
    .setData($data)
    .setUnit(unit)
    .setColor(fixedColor ? { mode: 'fixed', fixedColor } : undefined)
    .setOption('legend', { showLegend: true, placement: 'right' as LegendPlacement })
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
    .build();
}
