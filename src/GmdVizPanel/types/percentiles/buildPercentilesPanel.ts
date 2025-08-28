import { PanelBuilders, SceneQueryRunner } from '@grafana/scenes';
import { SortOrder, TooltipDisplayMode, type LegendPlacement } from '@grafana/schema';

import { type HistogramType, type PanelConfig, type QueryConfig } from 'GmdVizPanel/GmdVizPanel';
import { getPerSecondRateUnit, getUnit } from 'GmdVizPanel/units/getUnit';
import { trailDS } from 'shared';
import { getColorByIndex } from 'utils';

import { getPercentilesQueryRunnerParams } from './getPercentilesQueryRunnerParams';

type PercentilesPanelOptions = {
  metric: string;
  histogramType: HistogramType;
  panelConfig: PanelConfig;
  queryConfig: QueryConfig;
};

export function buildPercentilesPanel(options: PercentilesPanelOptions) {
  const { metric, histogramType, panelConfig, queryConfig } = options;
  const queryParams = getPercentilesQueryRunnerParams({ metric, histogramType, queryConfig });
  const unit = queryParams.isRateQuery ? getPerSecondRateUnit(metric) : getUnit(metric);

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
    .build();
}
