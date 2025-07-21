import { css } from '@emotion/css';
import { FieldType, type DataFrame, type GrafanaTheme2, type PanelData } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  PanelBuilders,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneDataNode,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneQueryRunner,
  SceneReactObject,
  type QueryVariable,
  type SceneComponentProps,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { Field, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { isNumber, max, min, throttle } from 'lodash';
import React from 'react';

import { METRICS_VIZ_PANEL_HEIGHT } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';

import { AddToFiltersGraphAction } from './AddToFiltersGraphAction';
import { BreakdownSearchReset, BreakdownSearchScene } from './BreakdownSearchScene';
import { ByFrameRepeater } from './ByFrameRepeater';
import { LayoutSwitcher } from './LayoutSwitcher';
import { type BreakdownLayoutChangeCallback } from './types';
import { getAutoQueriesForMetric } from '../autoQuery/getAutoQueriesForMetric';
import { type AutoQueryDef } from '../autoQuery/types';
import { reportExploreMetrics } from '../interactions';
import { PanelMenu } from '../Menu/PanelMenu';
import { MetricScene } from '../MetricScene';
import { getSortByPreference } from '../services/store';
import { ALL_VARIABLE_VALUE } from '../services/variables';
import { MDP_METRIC_PREVIEW, RefreshMetricsEvent, trailDS, VAR_GROUP_BY } from '../shared';
import { getColorByIndex, getTrailFor } from '../utils';
import { isQueryVariable } from '../utils/utils.variables';
import { MetricLabelsList } from './MetricLabelsList/MetricLabelsList';
import { SortByScene, SortCriteriaChanged } from './SortByScene';
import { BreakdownAxisChangeEvent, yAxisSyncBehavior } from './yAxisSyncBehavior';

export interface LabelBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher | MetricLabelsList;
  search: BreakdownSearchScene;
  sortBy: SortByScene;
}

export class LabelBreakdownScene extends SceneObjectBase<LabelBreakdownSceneState> {
  constructor(state: Partial<LabelBreakdownSceneState>) {
    super({
      ...state,
      sortBy: new SortByScene({ target: 'labels' }),
      search: new BreakdownSearchScene('labels'),
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _query?: AutoQueryDef;

  private _onActivate() {
    if (config.featureToggles.enableScopesInMetricsExplore) {
      this._subs.add(
        this.subscribeToEvent(RefreshMetricsEvent, () => {
          this.updateBody(this.getVariable());
        })
      );
    }

    this._subs.add(
      this.subscribeToEvent(BreakdownSearchReset, () => {
        this.state.search.clearValueFilter();
      })
    );

    this._subs.add(this.subscribeToEvent(SortCriteriaChanged, this.handleSortByChange));

    const metricScene = sceneGraph.getAncestor(this, MetricScene);
    const metric = metricScene.state.metric;
    this._query = getAutoQueriesForMetric(metric).breakdown;

    // The following state changes (and conditions) will each result in a call to `clearBreakdownPanelAxisValues`.
    // By clearing the axis, subsequent calls to `reportBreakdownPanelData` will adjust to an updated axis range.
    // These state changes coincide with the panels having their data updated, making a call to `reportBreakdownPanelData`.
    // If the axis was not cleared by `clearBreakdownPanelAxisValues` any calls to `reportBreakdownPanelData` which result
    // in the same axis will result in no updates to the panels.

    const trail = getTrailFor(this);
    trail.state.$timeRange?.subscribeToState(() => {
      // The change in time range will cause a refresh of panel values.
      this.clearBreakdownPanelAxisValues();
    });

    const groupByVariable = this.getVariable();

    groupByVariable.subscribeToState((newState, oldState) => {
      if (newState.value !== oldState.value) {
        this.updateBody(groupByVariable);
      }
    });

    this.updateBody(groupByVariable);
  }

  private breakdownPanelMaxValue: number | undefined;
  private breakdownPanelMinValue: number | undefined;

  public reportBreakdownPanelData(data: PanelData | undefined) {
    if (!data) {
      return;
    }

    let newMin = this.breakdownPanelMinValue;
    let newMax = this.breakdownPanelMaxValue;

    data.series.forEach((dataFrame) => {
      dataFrame.fields.forEach((breakdownData) => {
        if (breakdownData.type !== FieldType.number) {
          return;
        }
        const values = breakdownData.values.filter(isNumber);

        const maxValue = max(values);
        const minValue = min(values);

        newMax = max([newMax, maxValue].filter(isNumber));
        newMin = min([newMin, minValue].filter(isNumber));
      });
    });

    if (newMax === undefined || newMin === undefined || !Number.isFinite(newMax + newMin)) {
      return;
    }

    if (this.breakdownPanelMaxValue === newMax && this.breakdownPanelMinValue === newMin) {
      return;
    }

    this.breakdownPanelMaxValue = newMax;
    this.breakdownPanelMinValue = newMin;

    this._triggerAxisChangedEvent();
  }

  private _triggerAxisChangedEvent = throttle(() => {
    const { breakdownPanelMinValue, breakdownPanelMaxValue } = this;
    if (breakdownPanelMinValue !== undefined && breakdownPanelMaxValue !== undefined) {
      this.publishEvent(new BreakdownAxisChangeEvent({ min: breakdownPanelMinValue, max: breakdownPanelMaxValue }));
    }
  }, 1000);

  private clearBreakdownPanelAxisValues() {
    this.breakdownPanelMaxValue = undefined;
    this.breakdownPanelMinValue = undefined;
  }

  private getVariable(): QueryVariable {
    const groupByVariable = sceneGraph.lookupVariable(VAR_GROUP_BY, this)!;
    if (!isQueryVariable(groupByVariable)) {
      throw new Error('Group by variable not found');
    }
    return groupByVariable;
  }

  private handleSortByChange = (event: SortCriteriaChanged) => {
    if (event.target !== 'labels') {
      return;
    }

    reportExploreMetrics('sorting_changed', { from: 'label-breakdown', sortBy: event.sortBy });

    if (this.state.body instanceof LayoutSwitcher) {
      this.state.body.state.breakdownLayouts.forEach((layout) => {
        if (layout instanceof ByFrameRepeater) {
          layout.sort(event.sortBy);
          this._triggerAxisChangedEvent();
        }
      });
    }
  };

  private updateBody(groupByVariable: QueryVariable) {
    this.clearBreakdownPanelAxisValues();

    const metricScene = sceneGraph.getAncestor(this, MetricScene);

    this.setState({
      body: groupByVariable.hasAllValue()
        ? new MetricLabelsList({ metric: metricScene.state.metric })
        : buildNormalLayout(this._query!, this.onBreakdownLayoutChange, this.state.search),
    });
  }

  public onBreakdownLayoutChange = () => {
    this.clearBreakdownPanelAxisValues();
  };

  public static readonly Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const styles = useStyles2(getStyles);
    const { body, search, sortBy } = model.useState();

    const variable = model.getVariable();
    const { value } = variable.useState();

    return (
      <div className={styles.container}>
        <div className={styles.controls}>
          <Field label="By label">
            <variable.Component model={variable} />
          </Field>

          {value !== ALL_VARIABLE_VALUE && (
            <>
              <Field label="Search" className={styles.searchField}>
                <search.Component model={search} />
              </Field>
              <sortBy.Component model={sortBy} />
            </>
          )}
          {body instanceof LayoutSwitcher && (
            <Field label="View">
              <body.Selector model={body} />
            </Field>
          )}
          {body instanceof MetricLabelsList && (
            <Field label="View">
              <body.Selector model={body} />
            </Field>
          )}
        </div>
        <div data-testid="panels-list">
          {body instanceof LayoutSwitcher && <body.Component model={body} />}
          {body instanceof MetricLabelsList && <body.Component model={body} />}
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
      paddingTop: theme.spacing(1),
    }),
    searchField: css({
      flexGrow: 1,
    }),
    controls: css({
      flexGrow: 0,
      display: 'flex',
      alignItems: 'flex-end',
      gap: theme.spacing(2),
      justifyContent: 'space-between',
      height: '70px',
    }),
  };
}

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

function buildNormalLayout(
  queryDef: AutoQueryDef,
  onBreakdownLayoutChange: BreakdownLayoutChangeCallback,
  searchScene: BreakdownSearchScene
) {
  const unit = queryDef.unit;

  function getLayoutChild(data: PanelData, frame: DataFrame, frameIndex: number): SceneFlexItem {
    const vizPanel: VizPanel = queryDef
      .vizBuilder()
      .setTitle(getLabelValue(frame))
      .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
      .setColor({ mode: 'fixed', fixedColor: getColorByIndex(frameIndex) })
      .setHeaderActions([new AddToFiltersGraphAction({ frame })])
      .setShowMenuAlways(true)
      .setMenu(new PanelMenu({ labelName: getLabelValue(frame) }))
      .setUnit(unit)
      .build();

    // Find a frame that has at more than one point.
    const isHidden = frame.length <= 1;

    const item: SceneCSSGridItem = new SceneCSSGridItem({
      $behaviors: [yAxisSyncBehavior],
      body: vizPanel,
      isHidden,
    });

    return item;
  }

  const { sortBy } = getSortByPreference('labels', 'outliers');
  const getFilter = () => searchScene.state.filter ?? '';

  return new LayoutSwitcher({
    $data: new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: MDP_METRIC_PREVIEW,
      queries: queryDef.queries,
    }),
    breakdownLayoutOptions: [
      { value: 'single', label: 'Single' },
      { value: 'grid', label: 'Grid' },
      { value: 'rows', label: 'Rows' },
    ],
    onBreakdownLayoutChange,
    breakdownLayouts: [
      new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            minHeight: 300,
            body: PanelBuilders.timeseries()
              .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
              .setOption('legend', { showLegend: false })
              .setTitle('$metric')
              .build(),
          }),
        ],
      }),
      new ByFrameRepeater({
        body: new SceneCSSGridLayout({
          templateColumns: GRID_TEMPLATE_COLUMNS,
          autoRows: METRICS_VIZ_PANEL_HEIGHT,
          children: [
            new SceneFlexItem({
              body: new SceneReactObject({
                reactNode: <LoadingPlaceholder text="Loading..." />,
              }),
            }),
          ],
        }),
        getLayoutChild,
        sortBy,
        getFilter,
      }),
      new ByFrameRepeater({
        body: new SceneCSSGridLayout({
          templateColumns: '1fr',
          autoRows: METRICS_VIZ_PANEL_HEIGHT,
          children: [],
        }),
        getLayoutChild,
        sortBy,
        getFilter,
      }),
    ],
  });
}

function getLabelValue(frame: DataFrame) {
  const labels = frame.fields[1]?.labels || {};

  const keys = Object.keys(labels);
  if (keys.length === 0) {
    return '<unspecified>';
  }

  return labels[keys[0]];
}
