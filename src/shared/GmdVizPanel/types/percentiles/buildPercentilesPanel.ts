import { PanelBuilders, SceneQueryRunner } from '@grafana/scenes';
import { SortOrder, TooltipDisplayMode, type LegendPlacement } from '@grafana/schema';

import { type PanelConfig, type QueryConfig } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';
import { getPerSecondRateUnit, getUnit } from 'shared/GmdVizPanel/units/getUnit';
import { trailDS } from 'shared/shared';
import { getColorByIndex } from 'shared/utils/utils';

import { getPercentilesQueryRunnerParams } from './getPercentilesQueryRunnerParams';

type PercentilesPanelOptions = {
  metric: Metric;
  panelConfig: PanelConfig;
  queryConfig: QueryConfig;
};

export function buildPercentilesPanel(options: PercentilesPanelOptions) {
  const { metric, panelConfig, queryConfig } = options;
  const queryParams = getPercentilesQueryRunnerParams({ metric, queryConfig });
  const unit = queryParams.isRateQuery ? getPerSecondRateUnit(metric.name) : getUnit(metric.name);

  const $data =
    queryConfig.data ||
    new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: queryParams.maxDataPoints,
      queries: queryParams.queries,
    });

  const startColorIndex = panelConfig.fixedColorIndex || 0;

  return PanelBuilders.timeseries()
    .setTitle(panelConfig.title)
    .setDescription(panelConfig.description)
    .setHeaderActions(panelConfig.headerActions({ metric, panelConfig }))
    .setMenu(panelConfig.menu?.({ metric, panelConfig }))
    .setShowMenuAlways(Boolean(panelConfig.menu))
    .setData($data)
    .setUnit(unit)
    .setOption('legend', panelConfig.legend || { showLegend: true, placement: 'bottom' as LegendPlacement })
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
    .setCustomFieldConfig('fillOpacity', 9)
    .setOverrides((b) => {
      queryParams.queries.forEach((query, i) => {
        b.matchFieldsByQuery(query.refId).overrideColor({
          mode: 'fixed',
          fixedColor: getColorByIndex(startColorIndex + i),
        });
      });
    })
    .setBehaviors(panelConfig.behaviors || [])
    .build();
}
