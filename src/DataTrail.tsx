import { css } from '@emotion/css';
import { urlUtil, VariableHide, type AdHocVariableFilter, type GrafanaTheme2, type RawTimeRange } from '@grafana/data';
import { type PromQuery } from '@grafana/prometheus';
import { useChromeHeaderHeight } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  SceneControlsSpacer,
  sceneGraph,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  SceneReactObject,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  UrlSyncContextProvider,
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
import React, { useEffect, useRef } from 'react';

import { PluginInfo } from 'PluginInfo/PluginInfo';
import { getOtelExperienceToggleState } from 'services/store';
import { LabelsVariable } from 'WingmanDataTrail/Labels/LabelsVariable';
import { FilteredMetricsVariable } from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { MetricsVariable } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';

import { NativeHistogramBanner } from './banners/NativeHistogramBanner';
import { DataTrailSettings } from './DataTrailSettings';
import { MetricDatasourceHelper } from './helpers/MetricDatasourceHelper';
import { reportChangeInLabelFilters, reportExploreMetrics } from './interactions';
import { MetricScene } from './MetricScene';
import { MetricSelectScene } from './MetricSelect/MetricSelectScene';
import { MetricsHeader } from './MetricsHeader';
import { migrateOtelDeploymentEnvironment } from './migrations/otelDeploymentEnvironment';
import { getDeploymentEnvironments, getNonPromotedOtelResources, totalOtelResources } from './otel/api';
import {
  getOtelJoinQuery,
  getOtelResourcesObject,
  manageOtelAndMetricFilters,
  updateOtelData,
  updateOtelJoinWithGroupLeft,
} from './otel/util';
import {
  getVariablesWithOtelJoinQueryConstant,
  MetricSelectedEvent,
  trailDS,
  VAR_DATASOURCE,
  VAR_DATASOURCE_EXPR,
  VAR_FILTERS,
  VAR_MISSING_OTEL_TARGETS,
  VAR_OTEL_AND_METRIC_FILTERS,
  VAR_OTEL_DEPLOYMENT_ENV,
  VAR_OTEL_GROUP_LEFT,
  VAR_OTEL_JOIN_QUERY,
  VAR_OTEL_RESOURCES,
} from './shared';
import { getTrailStore } from './TrailStore/TrailStore';
import { getTrailFor, limitAdhocProviders } from './utils';
import { isSceneQueryRunner } from './utils/utils.queries';
import { getSelectedScopes } from './utils/utils.scopes';
import { isAdHocFiltersVariable, isConstantVariable } from './utils/utils.variables';
import {
  fetchAlertingMetrics,
  fetchDashboardMetrics,
} from './WingmanDataTrail/HeaderControls/MetricsSorter/MetricsSorter';

export interface DataTrailState extends SceneObjectState {
  topScene?: SceneObject;
  embedded?: boolean;
  controls: SceneObject[];
  settings: DataTrailSettings;
  pluginInfo: SceneReactObject;
  createdAt: number;

  // wingman
  dashboardMetrics?: Record<string, number>;
  alertingMetrics?: Record<string, number>;

  // just for the starting data source
  initialDS?: string;
  initialFilters?: AdHocVariableFilter[];

  // this is for otel, if the data source has it, it will be updated here
  hasOtelResources?: boolean;
  useOtelExperience?: boolean;
  isStandardOtel?: boolean;
  nonPromotedOtelResources?: string[];
  initialOtelCheckComplete?: boolean; // updated after the first otel check
  startButtonClicked?: boolean; // from original landing page
  resettingOtel?: boolean; // when switching OTel off from the switch
  addingLabelFromBreakdown?: boolean; // do not use the otel and metrics var subscription when adding label from the breakdown
  afterFirstOtelCheck?: boolean; // don't reset because of the migration on the first otel check from the data source updating

  // Synced with url
  metric?: string;
  metricSearch?: string;

  histogramsLoaded: boolean;
  nativeHistograms: string[];
  nativeHistogramMetric: string;

  trailActivated: boolean; // this indicates that the trail has been updated by metric or filter selected
}

export class DataTrail extends SceneObjectBase<DataTrailState> implements SceneObjectWithUrlSync {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['metric', 'metricSearch', 'nativeHistogramMetric'],
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
      settings: state.settings ?? new DataTrailSettings({}),
      pluginInfo: new SceneReactObject({ component: PluginInfo }),
      createdAt: state.createdAt ?? new Date().getTime(),
      dashboardMetrics: {},
      alertingMetrics: {},
      // default to false but update this to true on updateOtelData()
      // or true if the user either turned on the experience
      useOtelExperience: state.useOtelExperience ?? false,
      nativeHistograms: state.nativeHistograms ?? [],
      histogramsLoaded: state.histogramsLoaded ?? false,
      nativeHistogramMetric: state.nativeHistogramMetric ?? '',
      trailActivated: state.trailActivated ?? false,
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public _onActivate() {
    this.setState({ trailActivated: true });
    const urlParams = urlUtil.getUrlSearchParams();
    migrateOtelDeploymentEnvironment(this, urlParams);

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

    // INVESTIGATE
    // Every initiailization of GMD "changes" the datasource and
    // the variableDependency for VAR_DATASOURCE is called in
    // protected _variableDependency
    // This is where we do the OTel check
    // EXCEPT FOR gdev-prometheus.
    // Because gdev-prometheus does not activate the variable dependecy,
    // this is why this special handling exists
    const datasourceUid = sceneGraph.interpolate(this, VAR_DATASOURCE_EXPR);
    if (datasourceUid === 'gdev-prometheus') {
      this.checkDataSourceForOTelResources();
    }

    // This is for OTel consolidation filters
    // whenever the otel and metric filter is updated,
    // we need to add that filter to the correct otel resource var or var filter
    // so the filter can be interpolated in the query correctly
    const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, this);
    const otelFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, this);
    const otelJoinQueryVariable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, this);
    if (
      isAdHocFiltersVariable(otelAndMetricsFiltersVariable) &&
      isAdHocFiltersVariable(otelFiltersVariable) &&
      isAdHocFiltersVariable(filtersVariable) &&
      isConstantVariable(otelJoinQueryVariable)
    ) {
      this._subs.add(
        otelAndMetricsFiltersVariable?.subscribeToState((newState, prevState) => {
          // identify the added, updated or removed variables and update the correct filter,
          // either the otel resource or the var filter
          // do not update on switching on otel experience or the initial check
          // do not update when selecting a label from metric scene breakdown
          if (
            this.state.useOtelExperience &&
            this.state.initialOtelCheckComplete &&
            !this.state.addingLabelFromBreakdown
          ) {
            const nonPromotedOtelResources = this.state.nonPromotedOtelResources ?? [];
            manageOtelAndMetricFilters(
              newState.filters,
              prevState.filters,
              nonPromotedOtelResources,
              otelFiltersVariable,
              filtersVariable
            );
            const otelResourcesObject = getOtelResourcesObject(this);
            otelJoinQueryVariable.setState({ value: getOtelJoinQuery(otelResourcesObject) });
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

    // Fetch metric usage data
    this.updateMetricUsageData();

    return () => {
      if (!this.state.embedded) {
        saveRecentTrail();
      }
      window.removeEventListener('unload', saveRecentTrail);
    };
  }

  /**
   * Updates metric usage data from dashboards and alerting rules
   */
  private async updateMetricUsageData() {
    try {
      // Fetch both metrics sources concurrently
      const [dashboardMetrics, alertingMetrics] = await Promise.all([fetchDashboardMetrics(), fetchAlertingMetrics()]);

      this.setState({ dashboardMetrics, alertingMetrics });
    } catch (error) {
      console.error('Failed to fetch metric usage data:', error);
      this.setState({
        dashboardMetrics: {},
        alertingMetrics: {},
      });
    }
  }

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_OTEL_RESOURCES, VAR_OTEL_JOIN_QUERY, VAR_OTEL_AND_METRIC_FILTERS],
    onReferencedVariableValueChanged: async (variable: SceneVariable) => {
      const { name } = variable.state;

      if (name === VAR_DATASOURCE) {
        this.datasourceHelper.reset();

        // reset native histograms
        this.resetNativeHistograms();

        if (this.state.afterFirstOtelCheck) {
          // we need a new check for OTel
          this.setState({ initialOtelCheckComplete: false });
          // clear out the OTel filters, do not clear out var filters
          this.resetOtelExperience();
        }
        // fresh check for otel experience
        this.checkDataSourceForOTelResources();
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
    if (this.state.useOtelExperience) {
      otelAndMetricsFiltersVariable.setState({ filters: [...otelAndMetricsFiltersVariable.state.filters, filter] });
    } else {
      variable.setState({ filters: [...variable.state.filters, filter] });
    }
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

  // use this to initialize histograms in all scenes
  public async initializeHistograms() {
    if (!this.state.histogramsLoaded) {
      await this.datasourceHelper.initializeHistograms();

      this.setState({
        nativeHistograms: this.listNativeHistograms(),
        histogramsLoaded: true,
      });
    }
  }

  public listNativeHistograms() {
    return this.datasourceHelper.listNativeHistograms() ?? [];
  }

  private resetNativeHistograms() {
    this.setState({
      histogramsLoaded: false,
      nativeHistograms: [],
    });
  }

  public getCurrentMetricMetadata() {
    return this.getMetricMetadata(this.state.metric);
  }

  private async _handleMetricSelectedEvent(evt: MetricSelectedEvent) {
    // TODO: 02 SelectMetricAction - Main event handler that processes metric selection
    const metric = evt.payload ?? '';

    if (this.state.useOtelExperience) {
      await updateOtelJoinWithGroupLeft(this, metric);
    }

    // from the metric preview panel we have the info loaded to determine that a metric is a native histogram
    let nativeHistogramMetric = false;
    if (this.isNativeHistogram(metric)) {
      nativeHistogramMetric = true;
    }

    this.setState(this.getSceneUpdatesForNewMetricValue(metric, nativeHistogramMetric));

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
    stateUpdate.nativeHistogramMetric = nativeHistogramMetric ? '1' : '';
    stateUpdate.topScene = getTopSceneFor(metric, nativeHistogramMetric);

    return stateUpdate;
  }

  getUrlState(): SceneObjectUrlValues {
    const { metric, metricSearch, nativeHistogramMetric } = this.state;
    return {
      metric,
      metricSearch,
      // store the native histogram knowledge in url for the metric scene
      nativeHistogramMetric,
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
      stateUpdate.topScene = new MetricSelectScene({});
    }

    if (typeof values.metricSearch === 'string') {
      stateUpdate.metricSearch = values.metricSearch;
    } else if (values.metric == null) {
      stateUpdate.metricSearch = undefined;
    }

    this.setState(stateUpdate);
  }

  /**
   * Check that the data source has otel resources
   * Check that the data source is standard for OTEL
   * Show a warning if not
   * Update the following variables:
   * otelResources (filters), otelJoinQuery (used in the query)
   * Enable the otel experience
   *
   * @returns
   */
  public async checkDataSourceForOTelResources() {
    // call up in to the parent trail
    const trail = getTrailFor(this);

    // get the time range
    const timeRange: RawTimeRange | undefined = trail.state.$timeRange?.state;

    if (!timeRange) {
      return;
    }

    const datasourceUid = sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);
    const otelResources = await this.fetchOtelResources(datasourceUid, timeRange);

    // Check the local storage OTel toggle state
    const isEnabledInLocalStorage = getOtelExperienceToggleState();

    // This is the function that will turn on OTel for the entire app.
    // The conditions to use this function are
    // 1. must be an otel data source
    // 2. Do not turn it on if the start button was clicked
    // 3. Url or bookmark has previous otel filters
    // 4. We are resetting OTel with the toggle switch
    // 5. The OTel experience is enabled in local storage
    if (
      this.shouldEnableOtelExperience(otelResources, isEnabledInLocalStorage)
      // otelResources.hasOtelResources &&
      // otelResources.nonPromotedOtelResources && // it is an otel data source
      // !this.state.startButtonClicked && // we are not starting from the start button
      // (otelResources.previouslyUsedOtelResources || this.state.resettingOtel) && // there are otel filters or we are restting
      // isEnabledInLocalStorage // OTel experience is enabled in local storage
    ) {
      // HERE WE START THE OTEL EXPERIENCE ENGINE
      // 1. Set deployment variable values
      // 2. update all other variables and state
      updateOtelData(
        this,
        datasourceUid,
        timeRange,
        otelResources.deploymentEnvironments,
        otelResources.hasOtelResources,
        otelResources.nonPromotedOtelResources
      );
    } else {
      // this will update state to show the OTel toggle switch because hasOtelResources is the flag
      // hasOtelResources is checked in MetricSelectScene to show the OTel toggle switch
      this.resetOtelExperience(otelResources.hasOtelResources, otelResources.nonPromotedOtelResources);
    }
  }

  /**
   * Fetch OTel resources for a given datasource and time range
   */
  private async fetchOtelResources(datasourceUid: string, timeRange: RawTimeRange) {
    const otelTargets = await totalOtelResources(datasourceUid, timeRange);
    const deploymentEnvironments = await getDeploymentEnvironments(datasourceUid, timeRange, getSelectedScopes());
    const hasOtelResources = otelTargets.jobs.length > 0 && otelTargets.instances.length > 0;

    // loading from the url with otel resources selected will result in turning on OTel experience
    const otelResourcesVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, this);
    let previouslyUsedOtelResources = false;
    if (isAdHocFiltersVariable(otelResourcesVariable)) {
      previouslyUsedOtelResources = otelResourcesVariable.state.filters.length > 0;
    }

    // Future refactor: non promoted resources could be the full check
    //   - remove hasOtelResources
    //   - remove deployment environments as a check
    const nonPromotedOtelResources = await getNonPromotedOtelResources(datasourceUid, timeRange);

    return {
      otelTargets,
      deploymentEnvironments,
      hasOtelResources,
      previouslyUsedOtelResources,
      nonPromotedOtelResources,
    };
  }

  /**
   * Determines if the OTel experience should be enabled based on several conditions
   *
   * @param otelResources - The OTel resources information
   * @param isEnabledInLocalStorage - Whether OTel experience is enabled in local storage
   * @returns boolean - True if OTel experience should be enabled
   */
  private shouldEnableOtelExperience(
    otelResources: {
      hasOtelResources: boolean;
      nonPromotedOtelResources: string[];
      previouslyUsedOtelResources: boolean;
    },
    isEnabledInLocalStorage: boolean
  ): boolean {
    return (
      otelResources.hasOtelResources &&
      //otelResources.nonPromotedOtelResources.length && // it is an otel data source
      !this.state.startButtonClicked && // we are not starting from the start button
      (otelResources.previouslyUsedOtelResources || this.state.resettingOtel || false) && // there are otel filters or we are resetting
      isEnabledInLocalStorage // OTel experience is enabled in local storage
    );
  }

  resetOtelExperience(hasOtelResources?: boolean, nonPromotedResources?: string[]) {
    const otelResourcesVariable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, this);
    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, this);
    const otelJoinQueryVariable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, this);

    if (
      !(
        isAdHocFiltersVariable(otelResourcesVariable) &&
        isAdHocFiltersVariable(filtersVariable) &&
        isAdHocFiltersVariable(otelAndMetricsFiltersVariable) &&
        isConstantVariable(otelJoinQueryVariable)
      )
    ) {
      return;
    }

    // show the var filters normally
    filtersVariable.setState({
      addFilterButtonText: 'Add label',
      label: 'Select label',
      hide: VariableHide.hideLabel,
    });

    // Resetting the otel experience filters means clearing both the otel resources var and the otelMetricsVar
    // hide the super otel and metric filter and reset it
    otelAndMetricsFiltersVariable.setState({
      filters: [],
      hide: VariableHide.hideVariable,
    });

    // if there are no resources reset the otel variables and otel state
    // or if not standard
    otelResourcesVariable.setState({
      filters: [],
      defaultKeys: [],
      hide: VariableHide.hideVariable,
    });

    otelJoinQueryVariable.setState({ value: '' });

    // potential full reset when a data source fails the check or is the initial check with turning off
    if (hasOtelResources && nonPromotedResources) {
      this.setState({
        hasOtelResources,
        isStandardOtel: nonPromotedResources.length > 0,
        useOtelExperience: false,
        initialOtelCheckComplete: true,
        afterFirstOtelCheck: true,
      });
    } else {
      // partial reset when a user turns off the otel experience
      this.setState({
        useOtelExperience: false,
        initialOtelCheckComplete: true,
        afterFirstOtelCheck: true,
      });
    }
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

  static Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const {
      controls,
      topScene,
      settings,
      pluginInfo,
      useOtelExperience,
      embedded,
      histogramsLoaded,
      nativeHistograms,
    } = model.useState();

    const chromeHeaderHeight = useChromeHeaderHeight();
    const styles = useStyles2(getStyles, embedded ? 0 : chromeHeaderHeight ?? 0);
    const showHeaderForFirstTimeUsers = getTrailStore().recent.length < 2;
    // need to initialize this here and not on activate because it requires the data source helper to be fully initialized first
    model.initializeHistograms();

    useEffect(() => {
      const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, model);
      const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, model);
      const limitedFilterVariable = useOtelExperience ? otelAndMetricsFiltersVariable : filtersVariable;
      const datasourceHelper = model.datasourceHelper;
      limitAdhocProviders(model, limitedFilterVariable, datasourceHelper);
    }, [model, useOtelExperience]);

    const reportOtelExperience = useRef(false);
    // only report otel experience once
    if (useOtelExperience && !reportOtelExperience.current) {
      reportExploreMetrics('otel_experience_used', {});
      reportOtelExperience.current = true;
    }

    return (
      <div className={styles.container}>
        {NativeHistogramBanner({ histogramsLoaded, nativeHistograms, trail: model })}
        {showHeaderForFirstTimeUsers && <MetricsHeader />}
        {controls && (
          <div className={styles.controls} data-testid="app-controls">
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
            <div className={styles.settingsInfo}>
              <settings.Component model={settings} />
              <pluginInfo.Component model={pluginInfo} />
            </div>
          </div>
        )}
        {topScene && (
          <UrlSyncContextProvider scene={topScene} createBrowserHistorySteps={true} updateUrlOnInit={true}>
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
    return new MetricSelectScene({});
  }
}

function getVariableSet(initialDS?: string, metric?: string, initialFilters?: AdHocVariableFilter[]) {
  return new SceneVariableSet({
    variables: [
      new DataSourceVariable({
        key: VAR_DATASOURCE,
        name: VAR_DATASOURCE,
        label: 'Data source',
        description: 'Only prometheus data sources are supported',
        value: initialDS,
        pluginId: 'prometheus',
      }),
      new AdHocFiltersVariable({
        name: VAR_OTEL_RESOURCES,
        label: 'Select resource attributes',
        addFilterButtonText: 'Select resource attributes',
        datasource: trailDS,
        hide: VariableHide.hideVariable,
        layout: 'combobox',
        defaultKeys: [],
        applyMode: 'manual',
        allowCustomValue: true,
      }),
      new AdHocFiltersVariable({
        key: VAR_FILTERS,
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
          // remove any filters that include __name__ key in the expression
          // to prevent the metric name from being set twice in the query and causing an error.
          const filtersWithoutMetricName = filters.filter((filter) => filter.key !== '__name__');
          return [...getBaseFiltersForMetric(metric), ...filtersWithoutMetricName]
            .map((filter) => `${filter.key}${filter.operator}"${filter.value}"`)
            .join(',');
        },
      }),
      ...getVariablesWithOtelJoinQueryConstant(),
      new ConstantVariable({
        name: VAR_OTEL_GROUP_LEFT,
        value: undefined,
        hide: VariableHide.hideVariable,
      }),
      new ConstantVariable({
        name: VAR_MISSING_OTEL_TARGETS,
        hide: VariableHide.hideVariable,
        value: false,
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
      // Legacy variable needed for bookmarking which is necessary because
      // url sync method does not handle multiple dep env values
      // Remove this when the rudderstack event "deployment_environment_migrated" tapers off
      new CustomVariable({
        name: VAR_OTEL_DEPLOYMENT_ENV,
        label: 'Deployment environment',
        hide: VariableHide.hideVariable,
        value: undefined,
        placeholder: 'Select',
        isMulti: true,
      }),
      new MetricsVariable({}),
      new FilteredMetricsVariable(),
      new LabelsVariable(),
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
    settingsInfo: css({
      display: 'flex',
      gap: theme.spacing(0.5),
    }),
  };
}

function getBaseFiltersForMetric(metric?: string): AdHocVariableFilter[] {
  if (metric) {
    return [{ key: '__name__', operator: '=', value: metric }];
  }
  return [];
}
