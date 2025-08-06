import { css } from '@emotion/css';
import { DashboardCursorSync, LoadingState, type DataFrame, type GrafanaTheme2, type PanelData } from '@grafana/data';
import {
  behaviors,
  PanelBuilders,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneDataNode,
  SceneDataTransformer,
  sceneGraph,
  SceneObjectBase,
  SceneQueryRunner,
  SceneReactObject,
  sceneUtils,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Field, Spinner, useStyles2 } from '@grafana/ui';
import React from 'react';

import { InlineBanner } from 'App/InlineBanner';
import { getPerSecondRateUnit, getUnit } from 'autoQuery/units';
import { publishTimeseriesData } from 'Breakdown/MetricLabelsList/behaviors/publishTimeseriesData';
import { syncYAxis } from 'Breakdown/MetricLabelsList/behaviors/syncYAxis';
import { addUnspecifiedLabel } from 'Breakdown/MetricLabelsList/transformations/addUnspecifiedLabel';
import { GmdVizPanel, PANEL_HEIGHT, PANEL_TYPE, QUERY_RESOLUTION } from 'GmdVizPanel/GmdVizPanel';
import { getTimeseriesQueryRunnerParams } from 'GmdVizPanel/timeseries/getTimeseriesQueryRunnerParams';
import { PanelMenu } from 'Menu/PanelMenu';
import { trailDS } from 'shared';
import { getColorByIndex } from 'utils';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'WingmanDataTrail/ListControls/LayoutSwitcher';
import { EventQuickSearchChanged } from 'WingmanDataTrail/ListControls/QuickSearch/EventQuickSearchChanged';
import { QuickSearch } from 'WingmanDataTrail/ListControls/QuickSearch/QuickSearch';
import { GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS } from 'WingmanDataTrail/MetricsList/MetricsList';
import { METRICS_VIZ_PANEL_HEIGHT } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';
import { ShowMoreButton } from 'WingmanDataTrail/ShowMoreButton';

import { AddToFiltersGraphAction } from './AddToFiltersGraphAction';
import { getLabelValueFromDataFrame } from './getLabelValueFromDataFrame';
import { LabelValuesCountsProvider } from './LabelValuesCountProvider';
import { SceneByFrameRepeater } from './SceneByFrameRepeater';
import { SortBySelector, type SortBySelectorState } from './SortBySelector';

interface MetricLabelsValuesListState extends SceneObjectState {
  metric: string;
  label: string;
  layoutSwitcher: LayoutSwitcher;
  quickSearch: QuickSearch;
  sortBySelector: SortBySelector;
  body?: SceneByFrameRepeater | GmdVizPanel;
}

export class MetricLabelValuesList extends SceneObjectBase<MetricLabelsValuesListState> {
  constructor({
    metric,
    label,
  }: {
    metric: MetricLabelsValuesListState['metric'];
    label: MetricLabelsValuesListState['label'];
  }) {
    super({
      key: 'metric-label-values-list',
      metric,
      label,
      layoutSwitcher: new LayoutSwitcher({
        urlSearchParamName: 'breakdownLayout',
        options: [
          { label: 'Single', value: LayoutType.SINGLE },
          { label: 'Grid', value: LayoutType.GRID },
          { label: 'Rows', value: LayoutType.ROWS },
        ],
      }),
      quickSearch: new QuickSearch({
        urlSearchParamName: 'breakdownSearchText',
        targetName: 'label value',
        countsProvider: new LabelValuesCountsProvider(),
        displayCounts: true,
      }),
      sortBySelector: new SortBySelector({ target: 'labels' }),
      body: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.subscribeToLayoutChange();
  }

  private subscribeToQuickSearchChange() {
    // We ensure the proper quick search value when landing on the page:
    // because MetricLabelValuesList is created dynamically when LabelBreakdownScene updates its body,
    // QuickSearch is not properly connected to the URL synchronization system
    sceneUtils.syncStateFromSearchParams(this.state.quickSearch, new URLSearchParams(window.location.search));

    this._subs.add(
      this.subscribeToEvent(EventQuickSearchChanged, (event) => {
        const byFrameRepeater = sceneGraph.findDescendents(this, SceneByFrameRepeater)[0];
        if (byFrameRepeater) {
          byFrameRepeater.filter(event.payload.searchText);
        }
      })
    );
  }

  private subscribeToSortByChange() {
    const { sortBySelector } = this.state;

    this._subs.add(
      sortBySelector.subscribeToState((newState: SortBySelectorState, prevState?: SortBySelectorState) => {
        if (newState.value.value !== prevState?.value.value) {
          const byFrameRepeater = sceneGraph.findDescendents(this, SceneByFrameRepeater)[0];
          if (byFrameRepeater) {
            byFrameRepeater.sort(newState.value.value);
          }
        }
      })
    );
  }

  private subscribeToLayoutChange() {
    const { layoutSwitcher } = this.state;

    // We ensure the proper layout when landing on the page:
    // because MetricLabelValuesList is created dynamically when LabelBreakdownScene updates its body,
    // LayoutSwitcher is not properly connected to the URL synchronization system
    sceneUtils.syncStateFromSearchParams(layoutSwitcher, new URLSearchParams(window.location.search));

    const onChangeState = (newState: LayoutSwitcherState, prevState?: LayoutSwitcherState) => {
      if (newState.layout !== prevState?.layout) {
        this.updateBody(newState.layout);
      }
    };

    onChangeState(layoutSwitcher.state);

    this._subs.add(layoutSwitcher.subscribeToState(onChangeState));
  }

  private updateBody(layout: LayoutType) {
    if (layout === LayoutType.SINGLE) {
      this.setState({ body: this.buildSinglePanel() });
      return;
    }

    const existingByFrameRepeater = sceneGraph.findDescendents(this, SceneByFrameRepeater)[0];
    const byFrameRepeater = existingByFrameRepeater || this.buildByFrameRepeater();

    (byFrameRepeater.state.body as SceneCSSGridLayout).setState({
      templateColumns: layout === LayoutType.ROWS ? GRID_TEMPLATE_ROWS : GRID_TEMPLATE_COLUMNS,
    });

    this.setState({ body: byFrameRepeater });

    if (!existingByFrameRepeater) {
      // we have to re-subscribe every time we build a new SceneByFrameRepeater instance because these controls (QuickSerach and SortBy) are not rendered when switching to the "Single" layout
      this.subscribeToQuickSearchChange();
      this.subscribeToSortByChange();
    }
  }

  private buildSinglePanel() {
    const { metric, label } = this.state;

    return new GmdVizPanel({
      metric,
      panelType: PANEL_TYPE.TIMESERIES,
      height: PANEL_HEIGHT.XL,
      headerActions: () => [],
      groupBy: label,
    });
  }

  private buildByFrameRepeater() {
    const { metric, label } = this.state;
    const queryParams = getTimeseriesQueryRunnerParams({
      metric,
      matchers: [],
      groupBy: label,
      queryResolution: QUERY_RESOLUTION.MEDIUM,
    });
    const unit = queryParams.isRateQuery ? getPerSecondRateUnit(metric) : getUnit(metric);

    return new SceneByFrameRepeater({
      $data: new SceneDataTransformer({
        $data: new SceneQueryRunner({
          datasource: trailDS,
          maxDataPoints: queryParams.maxDataPoints,
          queries: queryParams.queries,
        }),
        transformations: [addUnspecifiedLabel(label)],
      }),
      // we set the syncYAxis behavior here to ensure that the EventResetSyncYAxis events that are published by SceneByFrameRepeater can be received
      $behaviors: [
        syncYAxis(),
        new behaviors.CursorSync({
          key: 'metricCrosshairSync',
          sync: DashboardCursorSync.Crosshair,
        }),
      ],
      body: new SceneCSSGridLayout({
        children: [],
        isLazy: true,
        templateColumns: GRID_TEMPLATE_COLUMNS,
        autoRows: METRICS_VIZ_PANEL_HEIGHT,
      }),
      getLayoutLoading: () =>
        new SceneReactObject({
          reactNode: <Spinner inline />,
        }),
      getLayoutEmpty: () =>
        new SceneReactObject({
          reactNode: (
            <InlineBanner title="" severity="info">
              No label values found for the current filters and time range.
            </InlineBanner>
          ),
        }),
      getLayoutError: (data: PanelData) =>
        new SceneReactObject({
          reactNode: (
            <InlineBanner severity="error" title="Error while loading metrics!" error={data.errors![0] as Error} />
          ),
        }),
      getLayoutChild: (data: PanelData, frame: DataFrame, frameIndex: number) => {
        // hide frames that have less than 2 points
        if (frame.length < 2) {
          return null;
        }

        const labelValue = getLabelValueFromDataFrame(frame);
        const canAddToFilters = !labelValue.startsWith('<unspecified'); // see the "addUnspecifiedLabel" data transformation
        const headerActions = canAddToFilters ? [new AddToFiltersGraphAction({ labelName: label, labelValue })] : [];

        const vizPanel = PanelBuilders.timeseries()
          .setTitle(labelValue)
          .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
          .setUnit(unit)
          .setBehaviors([publishTimeseriesData()]) // publishTimeseriesData is required for the syncYAxis behavior
          .setColor({ mode: 'fixed', fixedColor: getColorByIndex(frameIndex) })
          .setHeaderActions(headerActions)
          .setOption('legend', { showLegend: false })
          .setShowMenuAlways(true)
          .setMenu(new PanelMenu({ labelName: labelValue }))
          .build();

        vizPanel.setState({ key: `panel-${metric}-${labelValue}` });

        return new SceneCSSGridItem({ body: vizPanel });
      },
    });
  }

  public Controls({ model }: { model: MetricLabelValuesList }) {
    const styles = useStyles2(getStyles); // eslint-disable-line react-hooks/rules-of-hooks
    const { body, quickSearch, layoutSwitcher, sortBySelector } = model.useState();

    return (
      <>
        {body instanceof SceneByFrameRepeater && (
          <>
            <Field className={styles.quickSearchField} label="Search">
              <quickSearch.Component model={quickSearch} />
            </Field>
            <sortBySelector.Component model={sortBySelector} />
          </>
        )}
        <Field label="View">
          <layoutSwitcher.Component model={layoutSwitcher} />
        </Field>
      </>
    );
  }

  public static readonly Component = ({ model }: SceneComponentProps<MetricLabelValuesList>) => {
    const { body } = model.useState();

    return (
      <>
        {body instanceof GmdVizPanel && <MetricLabelValuesList.SingleMetricPanelComponent model={model} />}
        {body instanceof SceneByFrameRepeater && <MetricLabelValuesList.ByFrameRepeaterComponent model={model} />}
      </>
    );
  };

  private static readonly SingleMetricPanelComponent = ({ model }: SceneComponentProps<MetricLabelValuesList>) => {
    const styles = useStyles2(getStyles);
    const { body } = model.useState();

    return (
      <div data-testid="single-metric-panel">
        <div className={styles.singlePanelContainer}>
          {body instanceof GmdVizPanel && <body.Component model={body} />}
        </div>
      </div>
    );
  };

  private static readonly ByFrameRepeaterComponent = ({ model }: SceneComponentProps<MetricLabelValuesList>) => {
    const styles = useStyles2(getStyles);
    const { body } = model.useState();

    const dataProvider = sceneGraph.getData(model);
    const { state, errors } = dataProvider.useState().data || {};

    const byFrameRepeater = body as SceneByFrameRepeater;

    const batchSizes = byFrameRepeater.useSizes();
    const shouldDisplayShowMoreButton =
      state !== LoadingState.Loading &&
      !errors?.length &&
      batchSizes.total > 0 &&
      batchSizes.current < batchSizes.total;

    const onClickShowMore = () => {
      byFrameRepeater.increaseBatchSize();
    };

    return (
      <div data-testid="label-values-list">
        <div className={styles.listContainer}>
          {body instanceof SceneByFrameRepeater && <body.Component model={body} />}
        </div>
        {shouldDisplayShowMoreButton && (
          <div className={styles.listFooter}>
            <ShowMoreButton label="label value" batchSizes={batchSizes} onClick={onClickShowMore} />
          </div>
        )}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    singlePanelContainer: css({
      width: '100%',
      height: '300px',
    }),
    listContainer: css({ width: '100%' }),
    listFooter: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: theme.spacing(4),

      '& button': {
        height: '40px',
        borderRadius: '8px',
      },
    }),
    quickSearchField: css({
      flexGrow: 1,
    }),
  };
}
