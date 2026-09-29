import { css, cx } from '@emotion/css';
import { DashboardCursorSync, type DataFrame, type GrafanaTheme2, type PanelData } from '@grafana/data';
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
  SceneVariableSet,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Field, Spinner, useStyles2 } from '@grafana/ui';
import React from 'react';

import { ShowMoreButton } from 'MetricsReducer/components/ShowMoreButton';
import { LabelValuesVariable, VAR_LABEL_VALUES } from 'MetricsReducer/labels/LabelValuesVariable';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'MetricsReducer/list-controls/LayoutSwitcher';
import { EventQuickSearchChanged } from 'MetricsReducer/list-controls/QuickSearch/EventQuickSearchChanged';
import { QuickSearch } from 'MetricsReducer/list-controls/QuickSearch/QuickSearch';
import { GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS } from 'MetricsReducer/MetricsList/MetricsList';
import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { getPreferredConfigForMetric } from 'shared/GmdVizPanel/config/getPreferredConfigForMetric';
import { PANEL_HEIGHT } from 'shared/GmdVizPanel/config/panel-heights';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { GmdVizPanel, type HistogramBreakdownFn } from 'shared/GmdVizPanel/GmdVizPanel';
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';
import { addCardinalityInfo } from 'shared/GmdVizPanel/types/timeseries/behaviors/addCardinalityInfo';
import {
  buildStaticTimeseriesPanel,
  buildTimeseriesPanel,
} from 'shared/GmdVizPanel/types/timeseries/buildTimeseriesPanel';
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

function getLabelValueTitle(frame: DataFrame | undefined, labelValue: string): string {
  if (frame) {
    return getLabelValueFromDataFrame(frame);
  }
  return labelValue || '<unspecified>';
}

function getValueHeaderActions(label: string, labelValue: string, binaryQuery?: string) {
  if (labelValue === '' || binaryQuery) {
    return () => [];
  }
  return () => [new AddToFiltersGraphAction({ labelName: label, labelValue })];
}

interface MetricLabelsValuesListState extends SceneObjectState {
  metric: Metric;
  label: string;
  // Set for a KG binary (ratio) insight. When present, values are enumerated from the grouped binary
  // (sum by(label)(binary)) and each per-value panel renders the binary scoped to that value.
  binaryQuery?: string;
  histogramBreakdownFn?: HistogramBreakdownFn;
  layoutSwitcher: LayoutSwitcher;
  quickSearch: QuickSearch;
  sortBySelector: SortBySelector;
  $variables?: SceneVariableSet;
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

    const labelValuesVariable = binaryQuery
      ? undefined
      : new LabelValuesVariable({
          labelName: label,
          matcher: buildQueryExpression({
            metric,
            labelMatchers: [],
            addIgnoreUsageFilter: false,
          }),
        });

    super({
      key: 'metric-label-values-list',
      metric,
      label,
      binaryQuery,
      histogramBreakdownFn,
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
      $variables: labelValuesVariable ? new SceneVariableSet({ variables: [labelValuesVariable] }) : undefined,
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
      HistogramBreakdownFn | undefined;

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
    const { binaryQuery } = this.state;

    return new SceneByFrameRepeater({
      variableName: binaryQuery ? undefined : VAR_LABEL_VALUES,
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
      getLayoutChild: (data: PanelData, frame: DataFrame | undefined, frameIndex: number, labelValue: string) => {
        // Binary expressions still enumerate from range-query frames, so preserve the existing guard.
        if (binaryQuery && (!frame || frame.length < 2)) {
          return null;
        }

        return new SceneCSSGridItem({ body: this.buildValuePanel(data, frame, frameIndex, labelValue) });
      },
    });
  }

  private buildValuePanel(data: PanelData, frame: DataFrame | undefined, frameIndex: number, labelValue: string) {
    const { metric, label, binaryQuery, histogramBreakdownFn } = this.state;
    const prefMetricConfig = getPreferredConfigForMetric(metric.name);
    const entry = getTrailFor(this).state.sourceMetrics?.find(
      (sourceMetric) => sourceMetric.metricName === metric.name
    );
    const labelValueFromDataFrame = getLabelValueTitle(frame, labelValue);
    const headerActions = getValueHeaderActions(label, labelValue, binaryQuery);
    const panelConfig = {
      type: 'timeseries' as const,
      title: labelValueFromDataFrame,
      height: PANEL_HEIGHT.M,
      fixedColorIndex: frameIndex,
      description: '',
      headerActions,
      menu: () => new PanelMenu({ labelName: label }),
      behaviors: [publishTimeseriesData()],
    };
    const isHistogram = metric.type === 'classic-histogram' || metric.type === 'native-histogram';

    if (isHistogram && frame) {
      return buildStaticTimeseriesPanel({ metric, data, frame, panelConfig });
    }

    if (isHistogram) {
      return buildTimeseriesPanel({
        metric,
        panelConfig,
        queryConfig: {
          resolution: QUERY_RESOLUTION.MEDIUM,
          labelMatchers: [{ key: label, operator: '=', value: labelValue }],
          addIgnoreUsageFilter: true,
          groupBy: label,
          customRateInterval: entry?.customRateInterval,
          customFunction: entry?.customFunction,
          histogramBreakdownFn,
        },
      });
    }

    const scopedQueryOptions = binaryQuery
      ? { binaryExpr: injectLabelMatcher(binaryQuery, label, labelValue), binaryLegend: labelValueFromDataFrame }
      : { labelMatchers: [{ key: label, operator: '=', value: labelValue }] };

    return new GmdVizPanel({
      metric: metric.name,
      discardUserPrefs: true,
      panelOptions: {
        ...prefMetricConfig?.panelOptions,
        title: labelValueFromDataFrame,
        fixedColorIndex: frameIndex,
        description: '',
        headerActions,
        menu: () => new PanelMenu({ labelName: label }),
        // publishTimeseriesData is required for the syncYAxis behavior (see MetricLabelsList).
        behaviors: [publishTimeseriesData()],
      },
      queryOptions: {
        ...prefMetricConfig?.queryOptions,
        ...scopedQueryOptions,
        customRateInterval: entry?.customRateInterval,
        customFunction: entry?.customFunction,
        kgMetricType: entry?.metricType,
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
    const { body, $variables } = model.useState();
    const labelValuesVariable = $variables?.state.variables.find(
      (variable) => variable.state.name === VAR_LABEL_VALUES
    ) as LabelValuesVariable | undefined;

    return (
      <>
        {body instanceof GmdVizPanel && <MetricLabelValuesList.SingleMetricPanelComponent model={model} />}
        {body instanceof SceneByFrameRepeater && <MetricLabelValuesList.ByFrameRepeaterComponent model={model} />}
        {body instanceof SceneByFrameRepeater && labelValuesVariable && (
          <div className={css({ display: 'none' })}>
            <labelValuesVariable.Component model={labelValuesVariable} />
          </div>
        )}
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

    const byFrameRepeater = body as SceneByFrameRepeater;
    const { loadingLayout, errorLayout } = byFrameRepeater.useState();

    const batchSizes = byFrameRepeater.useSizes();
    const shouldDisplayShowMoreButton =
      !loadingLayout && !errorLayout && batchSizes.total > 0 && batchSizes.current < batchSizes.total;

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
        borderRadius: theme.shape.radius.md,
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
