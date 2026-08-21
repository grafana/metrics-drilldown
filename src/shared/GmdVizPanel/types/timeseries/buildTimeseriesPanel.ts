import { type DataFrame, type PanelData } from '@grafana/data';
import { PanelBuilders, SceneDataNode, SceneDataTransformer, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { SortOrder, TooltipDisplayMode, type LegendPlacement } from '@grafana/schema';

import { extremeValueFilterBehavior } from 'shared/GmdVizPanel/behaviors/extremeValueFilterBehavior/extremeValueFilterBehavior';
import { type PanelConfig } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';
import { trailDS } from 'shared/shared';
import { getColorByIndex } from 'shared/utils/utils';

import { getPerSecondRateUnit, getUnit } from '../../units/getUnit';
import { type BuildVizPanelOptions } from '../panelBuilder';
import { updateColorsWhenQueriesChange } from './behaviors/updateColorsWhenQueriesChange';
import { getTimeseriesQueryRunnerParams } from './getTimeseriesQueryRunnerParams';
import { addRefId } from './transformations/addRefId';
import { addUnspecifiedLabel } from './transformations/addUnspecifiedLabel';
import { sliceSeries } from './transformations/sliceSeries';

// Shared by buildTimeseriesPanel and buildStaticTimeseriesPanel below, which both render one series (or
// a small number sharing a color) rather than buildGroupByPanel's many-series-per-panel case.
function applyCommonPanelOptions(
  builder: ReturnType<typeof PanelBuilders.timeseries>,
  metric: Metric,
  panelConfig: PanelConfig
) {
  return builder
    .setTitle(panelConfig.title)
    .setDescription(panelConfig.description)
    .setHeaderActions(panelConfig.headerActions({ metric, panelConfig }))
    .setMenu(panelConfig.menu?.({ metric, panelConfig }))
    .setShowMenuAlways(Boolean(panelConfig.menu))
    .setOption('annotations', { multiLane: true })
    .setOption('legend', panelConfig.legend || { showLegend: true, placement: 'bottom' as LegendPlacement })
    .setCustomFieldConfig('fillOpacity', 9);
}

export function buildTimeseriesPanel(options: BuildVizPanelOptions): VizPanel {
  if (options.queryConfig.groupBy) {
    return buildGroupByPanel(options as Required<BuildVizPanelOptions>);
  }

  const { metric, panelConfig, queryConfig } = options;
  const queryParams = getTimeseriesQueryRunnerParams({ metric, queryConfig });
  const unit = queryParams.isRateQuery ? getPerSecondRateUnit(metric.name) : getUnit(metric.name);

  const $data =
    queryConfig.data ||
    new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: queryParams.maxDataPoints,
      queries: queryParams.queries,
    });

  const vizPanelBuilder = applyCommonPanelOptions(PanelBuilders.timeseries(), metric, panelConfig)
    .setData($data)
    .setUnit(unit)
    .setBehaviors([
      extremeValueFilterBehavior,
      updateColorsWhenQueriesChange(panelConfig.fixedColorIndex),
      ...(panelConfig.behaviors || []),
    ]);

  if (queryParams.queries.length === 1) {
    vizPanelBuilder.setColor(
      panelConfig.fixedColorIndex
        ? { mode: 'fixed', fixedColor: getColorByIndex(panelConfig.fixedColorIndex) }
        : undefined
    );
  } else {
    const startColorIndex = panelConfig.fixedColorIndex || 0;

    vizPanelBuilder.setOverrides((b) => {
      queryParams.queries.forEach((query, i) => {
        b.matchFieldsByQuery(query.refId).overrideColor({
          mode: 'fixed',
          fixedColor: getColorByIndex(startColorIndex + i),
        });
      });
    });
  }

  return vizPanelBuilder.build();
}

// Renders one already-fetched frame with no query of its own, for a caller whose own shared query (see
// MetricLabelValuesList) already resolved metric.type correctly. A fresh per-panel query here would redo
// that work and re-race the same type resolution from scratch.
export function buildStaticTimeseriesPanel({
  metric,
  panelConfig,
  data,
  frame,
}: {
  metric: Metric;
  panelConfig: PanelConfig;
  data: PanelData;
  frame: DataFrame;
}): VizPanel {
  return applyCommonPanelOptions(PanelBuilders.timeseries(), metric, panelConfig)
    .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
    .setUnit(getUnit(metric.name))
    .setColor(
      panelConfig.fixedColorIndex !== undefined
        ? { mode: 'fixed', fixedColor: getColorByIndex(panelConfig.fixedColorIndex) }
        : undefined
    )
    .setBehaviors(panelConfig.behaviors || [])
    .build();
}

export const MAX_SERIES_TO_RENDER_WHEN_GROUPED_BY = 20;

function buildGroupByPanel(options: Required<BuildVizPanelOptions>): VizPanel {
  const { metric, panelConfig, queryConfig } = options;
  const queryParams = getTimeseriesQueryRunnerParams({ metric, queryConfig });
  const unit = queryParams.isRateQuery ? getPerSecondRateUnit(metric.name) : getUnit(metric.name);

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
    .setOption('annotations', { multiLane: true })
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
