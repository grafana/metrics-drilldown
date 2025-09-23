import { PanelBuilders, SceneDataTransformer, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { SortOrder, TooltipDisplayMode, type LegendPlacement } from '@grafana/schema';

import { extremeValueFilterBehavior } from 'shared/GmdVizPanel/behaviors/extremeValueFilterBehavior/extremeValueFilterBehavior';
import { type PanelConfig, type QueryConfig } from 'shared/GmdVizPanel/GmdVizPanel';
import { getIsCounterFromMetadata } from 'shared/GmdVizPanel/matchers/isCounterFromMetadata';
import { trailDS } from 'shared/shared';
import { getColorByIndex, getTrailFor } from 'shared/utils/utils';
import { isSceneQueryRunner } from 'shared/utils/utils.queries';

import { getTimeseriesQueryRunnerParams } from './getTimeseriesQueryRunnerParams';
import { addRefId } from './transformations/addRefId';
import { addUnspecifiedLabel } from './transformations/addUnspecifiedLabel';
import { sliceSeries } from './transformations/sliceSeries';
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

  const vizPanel = vizPanelBuilder.build();

  // Use Scenes lifecycle: run after this panel is activated/attached.
  vizPanel.addActivationHandler(() => {
    (async () => {
      const dataTrail = getTrailFor(vizPanel as unknown as any);
      const isCounter = await getIsCounterFromMetadata(metric, dataTrail);
      if (typeof isCounter !== 'boolean') {
        return; // inconclusive; keep heuristic
      }

      if (isCounter !== queryParams.isRateQuery) {
        const corrected = getTimeseriesQueryRunnerParams({ metric, queryConfig, isRateQueryOverride: isCounter });
        // Prefer the panel's direct SceneQueryRunner; if it's wrapped, bail (group-by path handles separately).
        const provider = vizPanel.state.$data as unknown as SceneQueryRunner;
        if (provider && isSceneQueryRunner(provider)) {
          provider.setState({
            maxDataPoints: corrected.maxDataPoints,
            queries: corrected.queries,
          });
          provider.runQueries();
        }
      }
    })().catch(() => {});
  });

  return vizPanel;
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
