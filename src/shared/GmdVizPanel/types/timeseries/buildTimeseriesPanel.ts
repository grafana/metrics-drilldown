import {
  PanelBuilders,
  SceneDataTransformer,
  sceneGraph,
  SceneQueryRunner,
  type VizPanel,
  type VizPanelState,
} from '@grafana/scenes';
import { SortOrder, TooltipDisplayMode, type LegendPlacement } from '@grafana/schema';

import { extremeValueFilterBehavior } from 'shared/GmdVizPanel/behaviors/extremeValueFilterBehavior/extremeValueFilterBehavior';
import { type PanelConfig, type QueryConfig } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';
import { trailDS } from 'shared/shared';
import { getColorByIndex } from 'shared/utils/utils';

import { getTimeseriesQueryRunnerParams } from './getTimeseriesQueryRunnerParams';
import { addRefId } from './transformations/addRefId';
import { addUnspecifiedLabel } from './transformations/addUnspecifiedLabel';
import { sliceSeries } from './transformations/sliceSeries';
import { getPerSecondRateUnit, getUnit } from '../../units/getUnit';

type TimeseriesPanelOptions = {
  metric: Metric;
  panelConfig: PanelConfig;
  queryConfig: QueryConfig;
};

export function buildTimeseriesPanel(options: TimeseriesPanelOptions): VizPanel {
  if (options.queryConfig.groupBy) {
    return buildGroupByPanel(options as Required<TimeseriesPanelOptions>);
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

  const vizPanel = vizPanelBuilder.build();

  updateColorsWhenQueriesChange(vizPanel, panelConfig);

  return vizPanel;
}

// Works hand in hand with GmdVizPanel.updatePanelQuery()
export function updateColorsWhenQueriesChange(vizPanel: VizPanel, panelConfig: PanelConfig) {
  const [queryRunner] = sceneGraph.findDescendents(vizPanel, SceneQueryRunner);
  if (!queryRunner) {
    return;
  }

  vizPanel.addActivationHandler(() => {
    const sub = queryRunner.subscribeToState((newState, prevState) => {
      if (newState.queries !== prevState.queries) {
        const fieldConfig: VizPanelState['fieldConfig'] = {
          ...vizPanel.state.fieldConfig,
        };

        const startColorIndex = panelConfig.fixedColorIndex || 0;

        fieldConfig.defaults.color = undefined;
        fieldConfig.overrides = newState.queries.map((q, i) => {
          return {
            matcher: {
              id: 'byFrameRefID',
              options: q.refId,
            },
            properties: [
              {
                id: 'color',
                value: { mode: 'fixed', fixedColor: getColorByIndex(startColorIndex + i) },
              },
            ],
          };
        });

        vizPanel.setState({ fieldConfig });
      }
    });

    return () => {
      sub.unsubscribe();
    };
  });
}

export const MAX_SERIES_TO_RENDER_WHEN_GROUPED_BY = 20;

function buildGroupByPanel(options: Required<TimeseriesPanelOptions>): VizPanel {
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
