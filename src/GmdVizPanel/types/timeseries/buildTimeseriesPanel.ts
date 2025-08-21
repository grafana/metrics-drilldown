import { PanelBuilders, SceneDataTransformer, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { SortOrder, TooltipDisplayMode, type LegendPlacement } from '@grafana/schema';

import { extremeValueFilterBehavior } from 'autoQuery/behaviors/ExtremeValueFilterBehavior';
import { addUnspecifiedLabel } from 'Breakdown/MetricLabelsList/transformations/addUnspecifiedLabel';
import { extremeValueFilterBehavior } from 'GmdVizPanel/behaviors/ExtremeValueFilterBehavior';
import { type PanelConfig, type QueryConfig } from 'GmdVizPanel/GmdVizPanel';
import { trailDS } from 'shared';
import { getColorByIndex } from 'utils';

import { getTimeseriesQueryRunnerParams } from './getTimeseriesQueryRunnerParams';
import { getPerSecondRateUnit, getUnit } from '../../units/getUnit';

type TimeseriesPanelOptions = {
  metric: string;
  panelConfig: PanelConfig;
  queryConfig: QueryConfig;
};

export function buildTimeseriesPanel(options: TimeseriesPanelOptions): VizPanel {
  if (options.queryConfig?.groupBy) {
    return buildGroupByPanel(options as Required<TimeseriesPanelOptions>);
  }

  const { metric, panelConfig, queryConfig } = options;
  const queryParams = getTimeseriesQueryRunnerParams({ metric, queryConfig });
  const unit = queryParams.isRateQuery ? getPerSecondRateUnit(metric) : getUnit(metric);

  const $data = new SceneQueryRunner({
    datasource: trailDS,
    maxDataPoints: queryParams.maxDataPoints,
    queries: queryParams.queries,
  });

  const vizPanelBuilder = PanelBuilders.timeseries()
    .setTitle(panelConfig.title)
    .setDescription(panelConfig.description)
    .setHeaderActions(panelConfig.headerActions({ metric, panelConfig }))
    .setMenu(panelConfig.menu?.clone()) // we clone because it's already stored in GmdVizPanel
    .setShowMenuAlways(Boolean(panelConfig.menu))
    .setData($data)
    .setUnit(unit)
    .setOption('legend', { showLegend: true, placement: 'bottom' as LegendPlacement })
    .setCustomFieldConfig('fillOpacity', 9)
    .setBehaviors([extremeValueFilterBehavior]);

  if (queryParams.queries.length > 1) {
    const startColorIndex = panelConfig.fixedColorIndex || 0;

    vizPanelBuilder.setOverrides((b) => {
      queryParams.queries.forEach((query, i) => {
        b.matchFieldsByQuery(query.refId).overrideColor({
          mode: 'fixed',
          fixedColor: getColorByIndex(startColorIndex + i),
        });
      });
    });
  } else {
    vizPanelBuilder.setColor(
      panelConfig.fixedColorIndex
        ? { mode: 'fixed', fixedColor: getColorByIndex(panelConfig.fixedColorIndex) }
        : undefined
    );
  }

  return vizPanelBuilder.build();
}

function buildGroupByPanel(options: Required<TimeseriesPanelOptions>): VizPanel {
  const { metric, panelConfig, queryConfig } = options;
  const queryParams = getTimeseriesQueryRunnerParams({ metric, queryConfig });
  const unit = queryParams.isRateQuery ? getPerSecondRateUnit(metric) : getUnit(metric);

  const $data = new SceneDataTransformer({
    $data: new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: queryParams.maxDataPoints,
      queries: queryParams.queries,
    }),
    transformations: [addUnspecifiedLabel(queryConfig.groupBy!)],
  });

  return PanelBuilders.timeseries()
    .setTitle(panelConfig.title)
    .setDescription(panelConfig.description)
    .setHeaderActions(panelConfig.headerActions({ metric, panelConfig }))
    .setMenu(panelConfig.menu?.clone()) // we clone because it's already stored in GmdVizPanel
    .setShowMenuAlways(Boolean(panelConfig.menu))
    .setData($data)
    .setUnit(unit)
    .setOption('legend', panelConfig.legend || { showLegend: true, placement: 'right' as LegendPlacement })
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
    .build();
}
