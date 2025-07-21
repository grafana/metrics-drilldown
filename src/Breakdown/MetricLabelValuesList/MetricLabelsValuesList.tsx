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
  VizPanel,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { SortOrder } from '@grafana/schema';
import { Field, Spinner, TooltipDisplayMode, useStyles2 } from '@grafana/ui';
import { debounce } from 'lodash';
import React from 'react';

import { InlineBanner } from 'App/InlineBanner';
import { getAutoQueriesForMetric } from 'autoQuery/getAutoQueriesForMetric';
import { publishTimeseriesData } from 'Breakdown/MetricLabelsList/behaviors/publishTimeseriesData';
import { syncYAxis } from 'Breakdown/MetricLabelsList/behaviors/syncYAxis';
import { addUnspecifiedLabel } from 'Breakdown/MetricLabelsList/transformations/addUnspecifiedLabel';
import {
  BreakdownQuickSearch,
  type BreakdownQuickSearchState,
} from 'Breakdown/MetricLabelValuesList/BreakdownQuickSearch';
import { PanelMenu } from 'Menu/PanelMenu';
import { MDP_METRIC_PREVIEW, trailDS } from 'shared';
import { getColorByIndex } from 'utils';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'WingmanDataTrail/ListControls/LayoutSwitcher';
import { GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS } from 'WingmanDataTrail/MetricsList/MetricsList';
import { METRICS_VIZ_PANEL_HEIGHT } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';
import { ShowMoreButton } from 'WingmanDataTrail/ShowMoreButton';

import { AddToFiltersGraphAction } from './AddToFiltersGraphAction';
import { getLabelValueFromDataFrame } from './getLabelValueFromDataFrame';
import { SceneByFrameRepeater } from './SceneByFrameRepeater';
import { SortBySelector } from './SortBySelector';

interface MetricLabelsValuesListState extends SceneObjectState {
  metric: string;
  label: string;
  $data: SceneDataTransformer;
  quickSearch: BreakdownQuickSearch;
  layoutSwitcher: LayoutSwitcher;
  sortBySelector: SortBySelector;
  body?: SceneByFrameRepeater | VizPanel;
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
      $data: new SceneDataTransformer({
        $data: new SceneQueryRunner({
          datasource: trailDS,
          maxDataPoints: MDP_METRIC_PREVIEW,
          queries: getAutoQueriesForMetric(metric).breakdown.queries,
        }),
        transformations: [addUnspecifiedLabel(label)],
      }),
      quickSearch: new BreakdownQuickSearch(), // TODO: replace by the existing QuickSearch component
      layoutSwitcher: new LayoutSwitcher({
        urlSearchParamName: 'breakdownLayout',
        options: [
          { label: 'Single', value: LayoutType.SINGLE },
          { label: 'Grid', value: LayoutType.GRID },
          { label: 'Rows', value: LayoutType.ROWS },
        ],
      }),
      sortBySelector: new SortBySelector({ target: 'labels' }),
      body: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    // TODO: sorting
    this.subscribeToQuickSearchChange();
    this.subscribeToLayoutChange();
  }

  // FIXME when data provider receives new data (e.g. after clicking on the refresh button)
  private subscribeToQuickSearchChange() {
    const quickSearch = sceneGraph.findByKeyAndType(this, 'breakdown-quick-search', BreakdownQuickSearch);

    const onChangeState = debounce((newState: BreakdownQuickSearchState, prevState?: BreakdownQuickSearchState) => {
      if (newState.value !== prevState?.value) {
        const byFrameRepeater = sceneGraph.findDescendents(this, SceneByFrameRepeater)[0];
        if (byFrameRepeater) {
          byFrameRepeater.filter(newState.value);
        }
      }
    }, 250);

    this._subs.add(quickSearch.subscribeToState(onChangeState));
  }

  private subscribeToLayoutChange() {
    const layoutSwitcher = sceneGraph.findByKeyAndType(this, 'layout-switcher', LayoutSwitcher);

    const onChangeState = (newState: LayoutSwitcherState, prevState?: LayoutSwitcherState) => {
      if (newState.layout !== prevState?.layout) {
        this.updateBody(newState.layout);
      }
    };

    onChangeState(layoutSwitcher.state); // ensure layout when landing on the page

    this._subs.add(layoutSwitcher.subscribeToState(onChangeState));
  }

  private updateBody(layout: LayoutType) {
    if (layout === LayoutType.SINGLE) {
      this.setState({ body: this.buildSinglePanel() });
      return;
    }

    const byFrameRepeater = sceneGraph.findDescendents(this, SceneByFrameRepeater)[0] || this.buildByFrameRepeater();
    const body = byFrameRepeater.state.body as SceneCSSGridLayout;

    body.setState({
      templateColumns: layout === LayoutType.ROWS ? GRID_TEMPLATE_ROWS : GRID_TEMPLATE_COLUMNS,
    });

    this.setState({ body: byFrameRepeater });
  }

  private buildSinglePanel() {
    const { metric } = this.state;

    return PanelBuilders.timeseries()
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi, sort: SortOrder.Descending })
      .setOption('legend', { showLegend: true, placement: 'right' })
      .setTitle(metric)
      .build();
  }

  private buildByFrameRepeater() {
    const { metric, label } = this.state;
    const queryDef = getAutoQueriesForMetric(metric).breakdown;
    const unit = queryDef.unit;

    return new SceneByFrameRepeater({
      body: new SceneCSSGridLayout({
        children: [],
        isLazy: true,
        templateColumns: GRID_TEMPLATE_COLUMNS,
        autoRows: METRICS_VIZ_PANEL_HEIGHT,
        $behaviors: [
          new behaviors.CursorSync({
            key: 'metricCrosshairSync',
            sync: DashboardCursorSync.Crosshair,
          }),
          syncYAxis(),
        ],
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
        const panelKey = `panel-${metric}-${labelValue}`;

        const canAddToFilters = !labelValue.startsWith('<unspecified'); // see the "addUnspecifiedLabel" data transformation
        const headerActions = canAddToFilters ? [new AddToFiltersGraphAction({ labelName: label, labelValue })] : [];

        // TODO: Use LabelVizPanel?
        const vizPanel = queryDef
          .vizBuilder()
          .setTitle(labelValue)
          .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
          // publishTimeseriesData is required for the syncYAxis behavior
          .setBehaviors([publishTimeseriesData({ sourcePanelKey: panelKey, forceYAxisUpdate: true })])
          .setColor({ mode: 'fixed', fixedColor: getColorByIndex(frameIndex) })
          .setHeaderActions(headerActions)
          .setShowMenuAlways(true)
          .setMenu(new PanelMenu({ labelName: labelValue }))
          .setUnit(unit)
          .build();

        vizPanel.setState({ key: panelKey });

        return new SceneCSSGridItem({ body: vizPanel });
      },
    });
  }

  public Controls({ model }: { model: MetricLabelValuesList }) {
    const { body, quickSearch, layoutSwitcher, sortBySelector } = model.useState();

    return (
      <>
        {body instanceof SceneByFrameRepeater && (
          <>
            <quickSearch.Component model={quickSearch} />
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
        {body instanceof VizPanel && <MetricLabelValuesList.SingleMetricPanelComponent model={model} />}
        {body instanceof SceneByFrameRepeater && <MetricLabelValuesList.ByFrameRepeaterComponent model={model} />}
      </>
    );
  };

  private static readonly SingleMetricPanelComponent = ({ model }: SceneComponentProps<MetricLabelValuesList>) => {
    const styles = useStyles2(getStyles);
    const { body } = model.useState();

    return (
      <div data-testid="single-metric-panel">
        <div className={styles.singlePanelContainer}>{body instanceof VizPanel && <body.Component model={body} />}</div>
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
  };
}
