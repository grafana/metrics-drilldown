import { css } from '@emotion/css';
import { urlUtil, VariableHide, type AdHocVariableFilter, type GrafanaTheme2 } from '@grafana/data';
import { type PromQuery } from '@grafana/prometheus';
import { locationService, useChromeHeaderHeight } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  DataSourceVariable,
  SceneControlsSpacer,
  sceneGraph,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  sceneUtils,
  SceneVariableSet,
  UrlSyncContextProvider,
  UrlSyncManager,
  VariableDependencyConfig,
  VariableValueSelectors,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type SceneObjectUrlValues,
  type SceneObjectWithUrlSync,
  type SceneQueryRunner,
  type SceneVariable,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricsReducer } from 'WingmanDataTrail/MetricsReducer';

import { DataTrailSettings } from '../DataTrailSettings';
import { DataTrailHistory } from '../DataTrailsHistory';
import { MetricDatasourceHelper } from '../helpers/MetricDatasourceHelper';
import { reportChangeInLabelFilters } from '../interactions';
import { MetricScene } from '../MetricScene';
import { MetricsHeader } from '../MetricsHeader';
import { MetricSelectedEvent, trailDS, VAR_DATASOURCE, VAR_FILTERS, VAR_OTEL_AND_METRIC_FILTERS } from '../shared';
import { getTrailStore } from '../TrailStore/TrailStore';
import { isSceneQueryRunner } from '../utils/utils.queries';
import { isAdHocFiltersVariable } from '../utils/utils.variables';
export interface DataTrailState extends SceneObjectState {
  topScene?: SceneObject;
  embedded?: boolean;
  controls: SceneObject[];
  history: DataTrailHistory;
  settings: DataTrailSettings;
  createdAt: number;

  // just for the starting data source
  initialDS?: string;
  initialFilters?: AdHocVariableFilter[];
  startButtonClicked?: boolean; // from original landing page
  afterFirstOtelCheck?: boolean; // when starting there is always a DS var change from variable dependency

  // moved into settings
  showPreviews?: boolean;

  // Synced with url
  metric?: string;
  metricSearch?: string;
}

export class WingmanDataTrail extends SceneObjectBase<DataTrailState> implements SceneObjectWithUrlSync {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['metric', 'metricSearch', 'showPreviews'],
  });

  public constructor(state: Partial<DataTrailState>) {
    super({
      $timeRange: state.$timeRange ?? new SceneTimeRange({}),
      // the initial variables should include a metric for metric scene and the otelJoinQuery.
      // NOTE: The other OTEL filters should be included too before this work is merged
      $variables: state.$variables ?? getVariableSet(state.initialDS, state.metric, state.initialFilters),
      controls: state.controls ?? [
        new VariableValueSelectors({ layout: 'vertical' }),
        new SceneControlsSpacer(),
        new SceneTimePicker({}),
        new SceneRefreshPicker({}),
      ],
      history: state.history ?? new DataTrailHistory({}),
      settings: state.settings ?? new DataTrailSettings({}),
      createdAt: state.createdAt ?? new Date().getTime(),
      showPreviews: state.showPreviews ?? true,
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public _onActivate() {
    if (!this.state.topScene) {
      this.setState({ topScene: getTopSceneFor(this.state.metric) });
    }

    // Some scene elements publish this
    this.subscribeToEvent(MetricSelectedEvent, this._handleMetricSelectedEvent.bind(this));

    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (isAdHocFiltersVariable(filtersVariable)) {
      this._subs.add(
        filtersVariable?.subscribeToState((newState, prevState) => {
          if (!this._addingFilterWithoutReportingInteraction) {
            reportChangeInLabelFilters(newState.filters, prevState.filters);
          }
        })
      );
    }

    // Save the current trail as a recent (if the browser closes or reloads) if user selects a metric OR applies filters to metric select view
    const saveRecentTrail = () => {
      const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);
      const hasFilters = isAdHocFiltersVariable(filtersVariable) && filtersVariable.state.filters.length > 0;
      if (this.state.metric || hasFilters) {
        getTrailStore().setRecentTrail(this);
      }
    };
    window.addEventListener('unload', saveRecentTrail);

    return () => {
      if (!this.state.embedded) {
        saveRecentTrail();
      }
      window.removeEventListener('unload', saveRecentTrail);
    };
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_OTEL_AND_METRIC_FILTERS],
    onReferencedVariableValueChanged: async (variable: SceneVariable) => {
      const { name } = variable.state;

      if (name === VAR_DATASOURCE) {
        this.datasourceHelper.reset();
      }
    },
  });

  /**
   * Assuming that the change in filter was already reported with a cause other than `'adhoc_filter'`,
   * this will modify the adhoc filter variable and prevent the automatic reporting which would
   * normally occur through the call to `reportChangeInLabelFilters`.
   */
  public addFilterWithoutReportingInteraction(filter: AdHocVariableFilter) {
    const variable = sceneGraph.lookupVariable('filters', this);
    const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, this);
    if (!isAdHocFiltersVariable(variable) || !isAdHocFiltersVariable(otelAndMetricsFiltersVariable)) {
      return;
    }

    this._addingFilterWithoutReportingInteraction = true;
    variable.setState({ filters: [...variable.state.filters, filter] });
    this._addingFilterWithoutReportingInteraction = false;
  }

  private _addingFilterWithoutReportingInteraction = false;
  private datasourceHelper = new MetricDatasourceHelper(this);

  public getMetricMetadata(metric?: string) {
    return this.datasourceHelper.getMetricMetadata(metric);
  }

  public isNativeHistogram(metric: string) {
    return this.datasourceHelper.isNativeHistogram(metric);
  }

  public listNativeHistograms() {
    return this.datasourceHelper.listNativeHistograms() ?? [];
  }

  public getCurrentMetricMetadata() {
    return this.getMetricMetadata(this.state.metric);
  }

  public restoreFromHistoryStep(state: DataTrailState) {
    if (!state.topScene && !state.metric) {
      // If the top scene for an  is missing, correct it.
      state.topScene = new MetricsReducer({});
    }

    this.setState(
      sceneUtils.cloneSceneObjectState(state, {
        history: this.state.history,
        metric: !state.metric ? undefined : state.metric,
        metricSearch: !state.metricSearch ? undefined : state.metricSearch,
      })
    );

    const urlState = new UrlSyncManager().getUrlState(this);
    const fullUrl = urlUtil.renderUrl(locationService.getLocation().pathname, urlState);
    locationService.replace(fullUrl);
  }

  private async _handleMetricSelectedEvent(evt: MetricSelectedEvent) {
    const metric = evt.payload ?? '';
    this.setState(this.getSceneUpdatesForNewMetricValue(metric, false));

    // Add metric to adhoc filters baseFilter
    const filterVar = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (isAdHocFiltersVariable(filterVar)) {
      filterVar.setState({
        baseFilters: getBaseFiltersForMetric(evt.payload),
      });
    }
  }

  private getSceneUpdatesForNewMetricValue(metric: string | undefined, nativeHistogramMetric?: boolean) {
    const stateUpdate: Partial<DataTrailState> = {};
    stateUpdate.metric = metric;
    // refactoring opportunity? Or do we pass metric knowledge all the way down?
    // must pass this native histogram prometheus knowledge deep into
    // the topscene set on the trail > MetricScene > getAutoQueriesForMetric() > createHistogramMetricQueryDefs();
    // stateUpdate.nativeHistogramMetric = nativeHistogramMetric ? '1' : '';
    stateUpdate.topScene = getTopSceneFor(metric, nativeHistogramMetric);
    return stateUpdate;
  }

  getUrlState(): SceneObjectUrlValues {
    const { metric, metricSearch, showPreviews } = this.state;
    return {
      metric,
      metricSearch,
      ...{ showPreviews: showPreviews === false ? 'false' : null },
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<DataTrailState> = {};

    if (typeof values.metric === 'string') {
      if (this.state.metric !== values.metric) {
        // if we have a metric and we have stored in the url that it is a native histogram
        // we can pass that info into the metric scene to generate the appropriate queries
        let nativeHistogramMetric = false;
        if (values.nativeHistogramMetric === '1') {
          nativeHistogramMetric = true;
        }

        Object.assign(stateUpdate, this.getSceneUpdatesForNewMetricValue(values.metric, nativeHistogramMetric));
      }
    } else if (values.metric == null) {
      stateUpdate.metric = undefined;
      stateUpdate.topScene = new MetricsReducer({});
    }

    if (typeof values.metricSearch === 'string') {
      stateUpdate.metricSearch = values.metricSearch;
    } else if (values.metric == null) {
      stateUpdate.metricSearch = undefined;
    }

    if (typeof values.showPreviews === 'string') {
      stateUpdate.showPreviews = values.showPreviews !== 'false';
    }

    this.setState(stateUpdate);
  }

  public getQueries(): PromQuery[] {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sqrs = sceneGraph.findAllObjects(this, (b) => isSceneQueryRunner(b)) as SceneQueryRunner[];

    return sqrs.reduce<PromQuery[]>((acc, sqr) => {
      acc.push(
        ...sqr.state.queries.map((q) => ({
          ...q,
          expr: sceneGraph.interpolate(sqr, q.expr),
        }))
      );

      return acc;
    }, []);
  }

  static Component = ({ model }: SceneComponentProps<WingmanDataTrail>) => {
    const { controls, topScene, history, settings, embedded } = model.useState();

    const chromeHeaderHeight = useChromeHeaderHeight();
    const styles = useStyles2(getStyles, embedded ? 0 : chromeHeaderHeight ?? 0);
    const showHeaderForFirstTimeUsers = getTrailStore().recent.length < 2;

    return (
      <div className={styles.container}>
        {showHeaderForFirstTimeUsers && <MetricsHeader />}
        <history.Component model={history} />
        {controls && (
          <div className={styles.controls}>
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
            <settings.Component model={settings} />
          </div>
        )}
        {topScene && (
          <UrlSyncContextProvider scene={topScene}>
            <div className={styles.body}>{topScene && <topScene.Component model={topScene} />}</div>
          </UrlSyncContextProvider>
        )}
      </div>
    );
  };
}

export function getTopSceneFor(metric?: string, nativeHistogram?: boolean) {
  if (metric) {
    return new MetricScene({ metric: metric, nativeHistogram: nativeHistogram ?? false });
  } else {
    return new MetricsReducer({});
  }
}

function getVariableSet(initialDS?: string, metric?: string, initialFilters?: AdHocVariableFilter[]) {
  return new SceneVariableSet({
    variables: [
      new DataSourceVariable({
        name: VAR_DATASOURCE,
        label: 'Data source',
        description: 'Only prometheus data sources are supported',
        value: initialDS,
        pluginId: 'prometheus',
      }),
      new AdHocFiltersVariable({
        name: VAR_FILTERS,
        addFilterButtonText: 'Add label',
        datasource: trailDS,
        // default to use var filters and have otel off
        hide: VariableHide.hideLabel,
        layout: 'combobox',
        filters: initialFilters ?? [],
        baseFilters: getBaseFiltersForMetric(metric),
        applyMode: 'manual',
        allowCustomValue: true,
        expressionBuilder: (filters: AdHocVariableFilter[]) => {
          return [...getBaseFiltersForMetric(metric), ...filters]
            .map((filter) => `${filter.key}${filter.operator}"${filter.value}"`)
            .join(',');
        },
      }),
      new AdHocFiltersVariable({
        name: VAR_OTEL_AND_METRIC_FILTERS,
        addFilterButtonText: 'Filter',
        datasource: trailDS,
        hide: VariableHide.hideVariable,
        layout: 'combobox',
        filters: initialFilters ?? [],
        baseFilters: getBaseFiltersForMetric(metric),
        applyMode: 'manual',
        allowCustomValue: true,
        // skipUrlSync: true
      }),
    ],
  });
}

function getStyles(theme: GrafanaTheme2, chromeHeaderHeight: number) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      gap: theme.spacing(1),
      flexDirection: 'column',
      background: theme.isLight ? theme.colors.background.primary : theme.colors.background.canvas,
      padding: theme.spacing(2, 3, 2, 3),
    }),
    body: css({
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
    }),
    controls: css({
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 0),
      alignItems: 'flex-end',
      flexWrap: 'wrap',
      position: 'sticky',
      background: theme.isDark ? theme.colors.background.canvas : theme.colors.background.primary,
      zIndex: theme.zIndex.navbarFixed,
      top: chromeHeaderHeight,
    }),
  };
}

function getBaseFiltersForMetric(metric?: string): AdHocVariableFilter[] {
  if (metric) {
    return [{ key: '__name__', operator: '=', value: metric }];
  }
  return [];
}
