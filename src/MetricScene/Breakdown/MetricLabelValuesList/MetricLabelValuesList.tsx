import { css, cx } from '@emotion/css';
import { DashboardCursorSync, LoadingState, type DataFrame, type GrafanaTheme2, type PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  behaviors,
  SceneCSSGridItem,
  SceneCSSGridLayout,
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

import { ShowMoreButton } from 'MetricsReducer/components/ShowMoreButton';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'MetricsReducer/list-controls/LayoutSwitcher';
import { EventQuickSearchChanged } from 'MetricsReducer/list-controls/QuickSearch/EventQuickSearchChanged';
import { QuickSearch } from 'MetricsReducer/list-controls/QuickSearch/QuickSearch';
import { GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS } from 'MetricsReducer/MetricsList/MetricsList';
import { getPreferredConfigForMetric } from 'shared/GmdVizPanel/config/getPreferredConfigForMetric';
import { PANEL_HEIGHT } from 'shared/GmdVizPanel/config/panel-heights';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { GmdVizPanel, type HistogramBreakdownFn } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';
import { addCardinalityInfo } from 'shared/GmdVizPanel/types/timeseries/behaviors/addCardinalityInfo';
import { buildStaticTimeseriesPanel } from 'shared/GmdVizPanel/types/timeseries/buildTimeseriesPanel';
import { getTimeseriesQueryRunnerParams } from 'shared/GmdVizPanel/types/timeseries/getTimeseriesQueryRunnerParams';
import { addUnspecifiedLabel } from 'shared/GmdVizPanel/types/timeseries/transformations/addUnspecifiedLabel';
import { trailDS, VAR_HISTOGRAM_BREAKDOWN_FN } from 'shared/shared';
import { injectLabelMatcher } from 'shared/utils/injectLabelMatcher';
import { getTrailFor } from 'shared/utils/utils';

import { AddToFiltersGraphAction } from './AddToFiltersGraphAction';
import { getLabelValueFromDataFrame } from './getLabelValueFromDataFrame';
import { LabelValuesCountsProvider } from './LabelValuesCountProvider';
import { SceneByFrameRepeater } from './SceneByFrameRepeater';
import { SortBySelector, type SortBySelectorState } from './SortBySelector';
import { InlineBanner } from '../../../App/InlineBanner';
import { PanelMenu } from '../../PanelMenu/PanelMenu';
import { publishTimeseriesData } from '../MetricLabelsList/behaviors/publishTimeseriesData';
import { syncYAxis } from '../MetricLabelsList/behaviors/syncYAxis';

interface MetricLabelsValuesListState extends SceneObjectState {
  metric: Metric;
  label: string;
  // Set for a KG binary (ratio) insight. When present, values are enumerated from the grouped binary
  // (sum by(label)(binary)) and each per-value panel renders the binary scoped to that value.
  binaryQuery?: string;
  layoutSwitcher: LayoutSwitcher;
  quickSearch: QuickSearch;
  sortBySelector: SortBySelector;
  body?: SceneByFrameRepeater | GmdVizPanel;
}

export class MetricLabelValuesList extends SceneObjectBase<MetricLabelsValuesListState> {
  constructor({
    metric,
    label,
    binaryQuery,
    histogramBreakdownFn,
  }: {
    metric: MetricLabelsValuesListState['metric'];
    label: MetricLabelsValuesListState['label'];
    binaryQuery?: string;
    // Passed by LabelBreakdownScene rather than looked up here: this constructor runs before `this` is
    // parented, so sceneGraph.lookupVariable can't reach it yet. Drives the query below, which per-value
    // panels render directly from (see getLayoutChild).
    histogramBreakdownFn?: HistogramBreakdownFn;
  }) {
    const queryParams = getTimeseriesQueryRunnerParams({
      metric,
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [],
        addIgnoreUsageFilter: false,
        groupBy: label,
        // For a binary (ratio) insight, enumerate values from the grouped binary (sum by(label)(binary))
        // rather than the anchor metric. Requires clean/bare operands so the label survives grouping.
        binaryExpr: binaryQuery,
        histogramBreakdownFn,
      },
    });

    super({
      key: 'metric-label-values-list',
      metric,
      label,
      binaryQuery,
      layoutSwitcher: new LayoutSwitcher({
        urlSearchParamName: 'breakdownLayout',
        options: [
          { label: t('layout-switcher.option.single', 'Single'), value: LayoutType.SINGLE },
          { label: t('layout-switcher.option.grid', 'Grid'), value: LayoutType.GRID },
          { label: t('layout-switcher.option.rows', 'Rows'), value: LayoutType.ROWS },
        ],
      }),
      quickSearch: new QuickSearch({
        urlSearchParamName: 'breakdownSearchText',
        targetName: 'label value',
        countsProvider: new LabelValuesCountsProvider(),
        displayCounts: true,
        ariaLabel: t('breakdown.label-values-list.search-aria-label', 'Quick search label values'),
      }),
      sortBySelector: new SortBySelector({ target: 'labels' }),
      $data: new SceneDataTransformer({
        $data: new SceneQueryRunner({
          datasource: trailDS,
          maxDataPoints: queryParams.maxDataPoints,
          queries: queryParams.queries,
        }),
        transformations: [addUnspecifiedLabel(label)],
      }),
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
    const entry = getTrailFor(this).state.sourceMetrics?.find((s) => s.metricName === metric.name);
    const histogramBreakdownFn = sceneGraph.lookupVariable(VAR_HISTOGRAM_BREAKDOWN_FN, this)?.getValue() as
      | HistogramBreakdownFn
      | undefined;

    return new GmdVizPanel({
      metric: metric.name,
      discardUserPrefs: true,
      panelOptions: {
        type: 'timeseries',
        height: PANEL_HEIGHT.XL,
        headerActions: () => [],
        behaviors: [addCardinalityInfo({ description: { ctaText: '' } })],
      },
      queryOptions: {
        groupBy: label,
        data: sceneGraph.getData(this),
        customRateInterval: entry?.customRateInterval,
        customFunction: entry?.customFunction,
        kgMetricType: entry?.metricType,
        histogramBreakdownFn,
      },
    });
  }

  private buildByFrameRepeater() {
    const { metric, label, binaryQuery } = this.state;
    const prefMetricConfig = getPreferredConfigForMetric(metric.name);
    const entry = getTrailFor(this).state.sourceMetrics?.find((s) => s.metricName === metric.name);
    // For a binary (ratio) insight, page filters do not apply, so hide the per-value "Add to filters" action.
    const isBinaryQuery = Boolean(binaryQuery);
    // Histogram panels render from this list's own shared query below (see buildStaticTimeseriesPanel)
    // instead of each reissuing its own.
    const isHistogram = metric.type === 'classic-histogram' || metric.type === 'native-histogram';

    return new SceneByFrameRepeater({
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
        autoRows: PANEL_HEIGHT.M,
      }),
      getLayoutLoading: () =>
        new SceneReactObject({
          reactNode: <Spinner inline />,
        }),
      getLayoutEmpty: () =>
        new SceneReactObject({
          reactNode: (
            <InlineBanner title="" severity="info">
              {t(
                'breakdown.label-values-list.no-values',
                'No label values found for the current filters and time range.'
              )}
            </InlineBanner>
          ),
        }),
      getLayoutError: (data: PanelData) =>
        new SceneReactObject({
          reactNode: (
            <InlineBanner
              severity="error"
              title={t('breakdown.label-values-list.error-title', 'Error while loading metrics!')}
              error={data.errors?.[0]}
            />
          ),
        }),
      getLayoutChild: (data: PanelData, frame: DataFrame, frameIndex: number) => {
        // hide frames that have less than 2 points
        if (frame.length < 2) {
          return null;
        }

        const labelValueFromDataFrame = getLabelValueFromDataFrame(frame);
        const isEmptyLabelValue = labelValueFromDataFrame.startsWith('<unspecified'); // see the "addUnspecifiedLabel" data transformation
        const labelValue = isEmptyLabelValue ? '' : labelValueFromDataFrame;

        const headerActions = isEmptyLabelValue || isBinaryQuery
          ? () => []
          : () => [new AddToFiltersGraphAction({ labelName: label, labelValue })];

        const vizPanel = isHistogram
          ? buildStaticTimeseriesPanel({
              metric,
              data,
              frame,
              panelConfig: {
                type: 'timeseries',
                title: labelValueFromDataFrame,
                height: PANEL_HEIGHT.M,
                fixedColorIndex: frameIndex,
                description: '',
                headerActions,
                menu: () => new PanelMenu({ labelName: label }),
                behaviors: [publishTimeseriesData()],
              },
            })
          : new GmdVizPanel({
              metric: metric.name,
              discardUserPrefs: true,
              panelOptions: {
                ...prefMetricConfig?.panelOptions,
                title: labelValueFromDataFrame,
                fixedColorIndex: frameIndex,
                description: '',
                headerActions,
                menu: () => new PanelMenu({ labelName: label }),
                // publishTimeseriesData is required for the syncYAxis behavior (see MetricLabelsList)
                // no worries to add it for all panel types here as it will check if the panel is a timeseries
                // and if the data frame received is a timeseries before acting
                behaviors: [publishTimeseriesData()],
              },
              queryOptions: {
                ...prefMetricConfig?.queryOptions,
                // Binary: render the ratio scoped to this value by injecting {label="value"} into both
                // operands. Otherwise: the single-metric selector filtered to the value.
                ...(binaryQuery
                  ? { binaryExpr: injectLabelMatcher(binaryQuery, label, labelValue), binaryLegend: labelValueFromDataFrame }
                  : { labelMatchers: [{ key: label, operator: '=', value: labelValue }] }),
                customRateInterval: entry?.customRateInterval,
                customFunction: entry?.customFunction,
                kgMetricType: entry?.metricType,
              },
            });

        return new SceneCSSGridItem({ body: vizPanel });
      },
    });
  }

  public Controls({ model }: { model: MetricLabelValuesList }) {
    const styles = useStyles2(getStyles);
    const { body, quickSearch, layoutSwitcher, sortBySelector } = model.useState();

    return (
      <>
        {body instanceof SceneByFrameRepeater && (
          <>
            <Field
              className={cx(styles.field, styles.quickSearchField)}
              label={t('breakdown.label-values-list.search-label', 'Search')}
            >
              <quickSearch.Component model={quickSearch} />
            </Field>
            <sortBySelector.Component model={sortBySelector} />
          </>
        )}
        <Field label={t('breakdown.label-values-list.view-label', 'View')} className={styles.field}>
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
            <ShowMoreButton batchSizes={batchSizes} onClick={onClickShowMore} />
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
    field: css({
      marginBottom: 0,
    }),
  };
}
