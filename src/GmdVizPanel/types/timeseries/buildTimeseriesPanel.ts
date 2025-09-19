import { PanelBuilders, SceneDataTransformer, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { SortOrder, TooltipDisplayMode, type LegendPlacement } from '@grafana/schema';

import { extremeValueFilterBehavior } from 'GmdVizPanel/behaviors/extremeValueFilterBehavior/extremeValueFilterBehavior';
import { type PanelConfig, type QueryConfig } from 'GmdVizPanel/GmdVizPanel';
import { addRefId } from 'GmdVizPanel/types/timeseries/transformations/addRefId';
import { addUnspecifiedLabel } from 'GmdVizPanel/types/timeseries/transformations/addUnspecifiedLabel';
import { sliceSeries } from 'GmdVizPanel/types/timeseries/transformations/sliceSeries';
import { trailDS } from 'shared';
import { getColorByIndex } from 'utils';

import { getTimeseriesQueryRunnerParams } from './getTimeseriesQueryRunnerParams';
import { getTrailFor } from 'utils';
import { getIsCounterFromMetadata } from 'GmdVizPanel/matchers/isCounterFromMetadata';
import { getPerSecondRateUnit, getUnit } from '../../units/getUnit';

type TimeseriesPanelOptions = {
  metric: string;
  panelConfig: PanelConfig;
  queryConfig: QueryConfig;
};

export function buildTimeseriesPanel(options: TimeseriesPanelOptions): VizPanel {
  if (options.queryConfig.groupBy) {
    return buildGroupByPanel(options as Required<TimeseriesPanelOptions>);
  }

  const { metric, panelConfig, queryConfig } = options;
  // Build immediately using heuristic so UI renders quickly.
  const queryParams = getTimeseriesQueryRunnerParams({ metric, queryConfig });
  const unit = queryParams.isRateQuery ? getPerSecondRateUnit(metric) : getUnit(metric);

  const $data =
    queryConfig.data ||
    new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: queryParams.maxDataPoints,
      queries: queryParams.queries,
    });

  const vizPanelBuilder = PanelBuilders.timeseries()
    .setTitle(panelConfig.title)
    .setDescription(panelConfig.description)
    .setHeaderActions(panelConfig.headerActions({ metric, panelConfig }))
    .setMenu(panelConfig.menu?.({ metric, panelConfig }))
    .setShowMenuAlways(Boolean(panelConfig.menu))
    .setData($data)
    .setUnit(unit)
    .setOption('legend', panelConfig.legend || { showLegend: true, placement: 'bottom' as LegendPlacement })
    .setCustomFieldConfig('fillOpacity', 9)
    .setBehaviors([extremeValueFilterBehavior, ...(panelConfig.behaviors || [])]);

  // After first render, verify heuristic with Prometheus metadata and, if needed,
  // rebuild the data query using isRateQueryOverride.
  // Only flips rate <-> raw for timeseries; other panel types handle their own logic.
  void (async () => {
    const dataTrail = getTrailFor(vizPanelBuilder as unknown as any);
    const isCounter = await getIsCounterFromMetadata(metric, dataTrail);
    if (typeof isCounter !== 'boolean') {
      return; // inconclusive; keep heuristic
    }

    if (isCounter !== queryParams.isRateQuery) {
      const corrected = getTimeseriesQueryRunnerParams({ metric, queryConfig, isRateQueryOverride: isCounter });
      ($data as any).setState({
        maxDataPoints: corrected.maxDataPoints,
        queries: corrected.queries,
      });
      const correctedUnit = corrected.isRateQuery ? getPerSecondRateUnit(metric) : getUnit(metric);
      vizPanelBuilder.setUnit(correctedUnit);
    }
  })();

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

export const MAX_SERIES_TO_RENDER_WHEN_GROUPED_BY = 20;

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
    transformations: [
      sliceSeries(0, MAX_SERIES_TO_RENDER_WHEN_GROUPED_BY),
      addUnspecifiedLabel(queryConfig.groupBy!),
      addRefId, // for overriding colors below
    ],
  });

  const { refId } = queryParams.queries[0];
  const startColorIndex = panelConfig.fixedColorIndex || 0;

  const vizPanel = PanelBuilders.timeseries()
    .setTitle(panelConfig.title)
    .setDescription(panelConfig.description)
    .setHeaderActions(panelConfig.headerActions({ metric, panelConfig }))
    .setMenu(panelConfig.menu?.({ metric, panelConfig }))
    .setShowMenuAlways(Boolean(panelConfig.menu))
    .setData($data)
    .setUnit(unit)
    .setOption('legend', panelConfig.legend || { showLegend: true, placement: 'right' as LegendPlacement })
    .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
    .setOverrides((b) => {
      for (let i = 0; i < MAX_SERIES_TO_RENDER_WHEN_GROUPED_BY; i++) {
        b.matchFieldsByQuery(`${refId}-${i}`).overrideColor({
          mode: 'fixed',
          fixedColor: getColorByIndex(startColorIndex + i),
        });
      }
    })
    .setBehaviors(panelConfig.behaviors)
    .build();

  return vizPanel;
}
