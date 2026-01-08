import { css } from '@emotion/css';
import { urlUtil, VariableHide, type AdHocVariableFilter, type GrafanaTheme2 } from '@grafana/data';
import { utf8Support } from '@grafana/prometheus';
import { config, useChromeHeaderHeight, usePluginComponent } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  SceneControlsSpacer,
  sceneGraph,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  sceneUtils,
  SceneVariableSet,
  ScopesVariable,
  UrlSyncContextProvider,
  VariableDependencyConfig,
  VariableValueSelectors,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type SceneObjectUrlValues,
  type SceneObjectWithUrlSync,
  type SceneVariable,
} from '@grafana/scenes';
import { Modal, Stack, useStyles2 } from '@grafana/ui';
import React, { createElement, useEffect } from 'react';

import { GiveFeedbackButton } from 'AppDataTrail/header/GiveFeedbackButton';
import { SceneDrawer } from 'MetricsReducer/components/SceneDrawer';
import { displaySuccess } from 'MetricsReducer/helpers/displayStatus';
import { registerRuntimeDataSources } from 'MetricsReducer/helpers/registerRuntimeDataSources';
import { LabelsDataSource } from 'MetricsReducer/labels/LabelsDataSource';
import { LabelsVariable } from 'MetricsReducer/labels/LabelsVariable';
import { addRecentMetric } from 'MetricsReducer/list-controls/MetricsSorter/MetricsSorter';
import { AdHocFiltersForMetricsVariable } from 'MetricsReducer/metrics-variables/AdHocFiltersForMetricsVariable';
import { MetricsVariable, VAR_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { MetricsReducer } from 'MetricsReducer/MetricsReducer';
import {
  ADD_TO_DASHBOARD_COMPONENT_ID,
  ADD_TO_DASHBOARD_LABEL,
} from 'shared/GmdVizPanel/components/addToDashboard/constants';
import {
  EventOpenAddToDashboard,
  type AddToDashboardFormProps,
} from 'shared/GmdVizPanel/components/addToDashboard/EventOpenAddToDashboard';
import { ConfigurePanelForm } from 'shared/GmdVizPanel/components/ConfigurePanelForm/ConfigurePanelForm';
import { EventApplyPanelConfig } from 'shared/GmdVizPanel/components/ConfigurePanelForm/EventApplyPanelConfig';
import { EventCancelConfigurePanel } from 'shared/GmdVizPanel/components/ConfigurePanelForm/EventCancelConfigurePanel';
import { EventConfigurePanel } from 'shared/GmdVizPanel/components/EventConfigurePanel';
import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { logger } from 'shared/logger/logger';

import { resetYAxisSync } from '../MetricScene/Breakdown/MetricLabelsList/behaviors/syncYAxis';
import { MetricScene } from '../MetricScene/MetricScene';
import { type PanelDataRequestPayload } from '../shared/GmdVizPanel/components/addToDashboard/addToDashboard';
import { MetricSelectedEvent, trailDS, VAR_DATASOURCE, VAR_FILTERS } from '../shared/shared';
import { reportChangeInLabelFilters, reportExploreMetrics } from '../shared/tracking/interactions';
import { getAppBackgroundColor } from '../shared/utils/utils.styles';
import { limitAdhocProviders } from '../shared/utils/utils.trail';
import { isAdHocFiltersVariable } from '../shared/utils/utils.variables';
import { PluginInfo } from './header/PluginInfo/PluginInfo';
import { SelectNewMetricButton } from './header/SelectNewMetricButton';
import { MetricDatasourceHelper } from './MetricDatasourceHelper/MetricDatasourceHelper';
import { MetricsDrilldownDataSourceVariable } from './MetricsDrilldownDataSourceVariable';

export interface DataTrailState extends SceneObjectState {
  topScene?: SceneObject;
  embedded?: boolean;
  embeddedMini?: boolean; // Mini embedded mode for tooltip preview navigation
  controls: SceneObject[];
  createdAt: number;

  // wingman
  dashboardMetrics?: Record<string, number>;
  alertingMetrics?: Record<string, number>;

  // just for the starting data source
  initialDS?: string;
  initialFilters?: AdHocVariableFilter[];

  // Synced with url
  metric?: string;

  urlNamespace?: string; // optional namespace for url params, to avoid conflicts with other plugins in embedded mode

  drawer: SceneDrawer;

  // Add to dashboard feature
  isAddToDashboardAvailable: boolean;
  isAddToDashboardModalOpen: boolean;
  addToDashboardPanelData?: PanelDataRequestPayload;
}

export class DataTrail extends SceneObjectBase<DataTrailState> implements SceneObjectWithUrlSync {
  private disableReportFiltersInteraction = false;
  private datasourceHelper = new MetricDatasourceHelper(this);

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE],
    onReferencedVariableValueChanged: () => {
      this.datasourceHelper.reset();
    },
  });

  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['metric'],
  });

  getUrlState(): SceneObjectUrlValues {
    return {
      metric: this.state.metric,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (this.state.embedded) {
      // In embedded mode, we want to avoid clearing a metric from the trail state
      // when the trail has been freshly instantiated and the URL doesn't yet contain the metric.
      return;
    }

    this.updateStateForNewMetric((values.metric as string) || undefined);
  }

  public constructor(state: Partial<DataTrailState>) {
    super({
      $timeRange: state.$timeRange ?? new SceneTimeRange({}),
      $variables: state.$variables ?? getVariableSet(state.initialDS, state.metric, state.initialFilters),
      controls: state.controls ?? [
        new VariableValueSelectors({ layout: 'vertical' }),
        new SceneControlsSpacer(),
        new SceneTimePicker({}),
        new SceneRefreshPicker({}),
      ],
      createdAt: state.createdAt ?? new Date().getTime(),
      dashboardMetrics: {},
      alertingMetrics: {},
      drawer: new SceneDrawer({}),
      isAddToDashboardAvailable: false,
      isAddToDashboardModalOpen: false,
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    registerRuntimeDataSources([new LabelsDataSource()]);

    // Delays init() to ensure proper initialization order and avoid race conditions.
    // The variable dependency handler (onReferencedVariableValueChanged) calls reset()
    // when landing, but we're uncertain whether it will always be called automatically
    // in all scenarios. Using setTimeout ensures init() runs after variable changes
    // are processed.
    setTimeout(() => {
      this.datasourceHelper.init();
    }, 0);

    this.updateStateForNewMetric(this.state.metric);
    this.subscribeToEvent(MetricSelectedEvent, (event) => this.handleMetricSelectedEvent(event));
    this.subscribeToEvent(EventOpenAddToDashboard, (event) => {
      this.openAddToDashboardModal(event.payload.panelData);
    });

    this.initFilters();
    this.initConfigPrometheusFunction();
  }

  private updateStateForNewMetric(metric?: string) {
    if (!this.state.topScene || metric !== this.state.metric) {
      // Update controls based on whether a metric is selected
      const baseControls = [new VariableValueSelectors({ layout: 'vertical' }), new SceneControlsSpacer()];

      // Only add SelectNewMetricButton when a metric is selected
      const controls = metric
        ? [...baseControls, new SelectNewMetricButton(), new SceneTimePicker({}), new SceneRefreshPicker({})]
        : [...baseControls, new SceneTimePicker({}), new SceneRefreshPicker({})];

      this.setState({
        metric,
        topScene: metric ? new MetricScene({ metric }) : new MetricsReducer(),
        controls,
      });
    }
  }

  private initFilters() {
    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (!isAdHocFiltersVariable(filtersVariable)) {
      return;
    }

    limitAdhocProviders(this, filtersVariable, this.datasourceHelper);

    // we ensure that, in the MetricsReducer, the Ad Hoc filters will display all the label names and values and
    // we ensure that, in the MetricScene, the queries in the Scene graph will be considered and used as a filter
    // to fetch label names and values
    filtersVariable?.setState({
      useQueriesAsFilterForOptions: Boolean(this.state.metric),
    });

    this.subscribeToState((newState, prevState) => {
      if (newState.metric !== prevState.metric) {
        const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);

        if (isAdHocFiltersVariable(filtersVariable)) {
          filtersVariable.setState({
            useQueriesAsFilterForOptions: Boolean(newState.metric),
          });
        }
      }
    });

    this._subs.add(
      filtersVariable?.subscribeToState((newState, prevState) => {
        if (!this.disableReportFiltersInteraction && newState.filters !== prevState.filters) {
          reportChangeInLabelFilters(newState.filters, prevState.filters);
        }
      })
    );
  }

  private initConfigPrometheusFunction() {
    this.subscribeToState((newState, prevState) => {
      if (newState.metric !== prevState.metric) {
        // ensures that the drawer is closed when using browser nav buttons
        this.state.drawer.close();
      }
    });

    this.subscribeToEvent(EventConfigurePanel, async (event) => {
      const { metric } = event.payload;

      reportExploreMetrics('configure_panel_opened', { metricType: metric.type });

      this.state.drawer.open({
        title: 'Configure the Prometheus function',
        subTitle: `${metric.name} (${metric.type})`,
        body: new ConfigurePanelForm({ metric }),
      });
    });

    this.subscribeToEvent(EventCancelConfigurePanel, () => {
      this.state.drawer.close();
    });

    this.subscribeToEvent(EventApplyPanelConfig, async (event) => {
      const { metric, config, restoreDefault } = event.payload;

      if (restoreDefault) {
        reportExploreMetrics('default_panel_config_restored', { metricType: metric.type });
      } else {
        reportExploreMetrics('panel_config_applied', { metricType: metric.type, configId: config.id });
      }

      this.state.drawer.close();

      // because the Prometheus function used to display the metric is going to be updated, the range of
      // values for syncing the axis will certainly change (e.g. switching from sum to avg)
      // so we reset it before updating all the panels
      resetYAxisSync(this.state.topScene || this);

      const panelsToUpdate = sceneGraph.findAllObjects(
        this.state.topScene || this,
        (o) => o instanceof GmdVizPanel && o.state.metric === metric.name && !o.state.queryConfig.groupBy
      ) as GmdVizPanel[];

      for (const panel of panelsToUpdate) {
        panel.update(config.panelOptions, config.queryOptions);
      }

      displaySuccess([
        `Configuration successfully ${restoreDefault ? 'restored' : 'applied'} for metric ${metric.name}!`,
      ]);
    });
  }

  private async handleMetricSelectedEvent(event: MetricSelectedEvent) {
    const { metric, urlValues } = event.payload;

    if (metric) {
      addRecentMetric(metric);

      // Track metric selection with hierarchical filter context
      const urlParams = new URLSearchParams(window.location.search);
      const prefixFilters =
        urlParams
          .get('filters-prefix')
          ?.split(',')
          .filter((v) => v) || [];
      const hierarchicalFilters = prefixFilters.filter((f) => f.includes(':'));

      reportExploreMetrics('metric_selected', {
        from: 'metric_list',
        searchTermCount: null,
        has_hierarchical_filter: hierarchicalFilters.length > 0,
        hierarchical_filter_count: hierarchicalFilters.length,
      });
    } else {
      // make sure we display all the proper metrics when coming back from the MetricScene (see RelatedMetricsScene.tsx, side bar sections in SideBar.tsx and RecentMetricsSection.tsx)
      sceneGraph.findByKeyAndType(this, VAR_METRICS_VARIABLE, MetricsVariable).fetchAllOrRecentMetrics();
    }

    // Add metric to adhoc filters baseFilter
    const filterVar = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (isAdHocFiltersVariable(filterVar)) {
      filterVar.setState({
        baseFilters: getBaseFiltersForMetric(metric),
      });
    }

    this._urlSync.performBrowserHistoryAction(() => {
      this.updateStateForNewMetric(metric);

      if (urlValues) {
        // make sure we reset the filters when navigating from a bookmark where urlsValues['var_vilters']: []
        // it seems relevant to do it here and not anywhere else in the code base
        if (!urlValues[`var-${VAR_FILTERS}`]?.length) {
          urlValues[`var-${VAR_FILTERS}`] = [''];
        }

        const urlState = urlUtil.renderUrl('', urlValues);
        sceneUtils.syncStateFromSearchParams(this, new URLSearchParams(urlState));
      }
    });
  }

  // we use the class field syntax with an arrow function to bind this properly so its usage is easier (see the component below)
  private getPrometheusBuildInfo = async () => {
    return this.datasourceHelper.getPrometheusBuildInfo();
  };

  /**
   * Assuming that the change in filter was already reported with a cause other than `'adhoc_filter'`,
   * this will modify the adhoc filter variable and prevent the automatic reporting which would
   * normally occur through the call to `reportChangeInLabelFilters`.
   *
   * See AddToFiltersGraphAction.tsx
   */
  public addFilterWithoutReportingInteraction(filter: AdHocVariableFilter) {
    const variable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (!isAdHocFiltersVariable(variable)) {
      return;
    }

    this.disableReportFiltersInteraction = true;
    variable.setState({ filters: [...variable.state.filters, filter] });
    this.disableReportFiltersInteraction = false;
  }

  public async getMetadataForMetric(metric: string) {
    return this.datasourceHelper.getMetadataForMetric(metric);
  }

  public async fetchRecentMetrics({ interval, extraFilter }: { interval: string; extraFilter?: string }) {
    return this.datasourceHelper.fetchRecentMetrics({ interval, extraFilter });
  }

  public openAddToDashboardModal(panelData: PanelDataRequestPayload) {
    reportExploreMetrics('add_to_dashboard_modal_opened', {});
    this.setState({
      isAddToDashboardModalOpen: true,
      addToDashboardPanelData: panelData,
    });
  }

  public closeAddToDashboardModal = () => {
    this.setState({
      isAddToDashboardModalOpen: false,
      addToDashboardPanelData: undefined,
    });
  };

  static readonly Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const { controls, topScene, embedded, embeddedMini, drawer, isAddToDashboardModalOpen, addToDashboardPanelData } =
      model.useState();

    const chromeHeaderHeight = useChromeHeaderHeight() ?? 0;
    const headerHeight = embedded ? 0 : chromeHeaderHeight;
    const styles = useStyles2(getStyles, headerHeight, model);

    const { component: AddToDashboardComponent, isLoading: isLoadingAddToDashboard } =
      usePluginComponent(ADD_TO_DASHBOARD_COMPONENT_ID);

    // Update availability flag when component loads
    useEffect(() => {
      const isAvailable = !isLoadingAddToDashboard && Boolean(AddToDashboardComponent);

      // Log warning if component failed to load
      if (!isLoadingAddToDashboard && !AddToDashboardComponent) {
        logger.warn(`Failed to load add to dashboard component: ${ADD_TO_DASHBOARD_COMPONENT_ID}`);
      }

      if (model.state.isAddToDashboardAvailable !== isAvailable) {
        model.setState({ isAddToDashboardAvailable: isAvailable });
      }
    }, [isLoadingAddToDashboard, AddToDashboardComponent, model]);

    // Set CSS custom property for app-controls height in embedded mode
    useEffect(() => {
      // Update on mount and when controls change
      updateAppControlsHeight();

      // Use ResizeObserver to watch for height changes
      const appControls = document.querySelector('[data-testid="app-controls"]');

      if (!appControls) {
        return;
      }

      const resizeObserver = new ResizeObserver(updateAppControlsHeight);
      resizeObserver.observe(appControls);

      return () => {
        // Clean up
        resizeObserver.disconnect();
        document.documentElement.style.removeProperty('--app-controls-height');
      };
    }, [embedded, controls]);

    return (
      <>
        <div className={styles.container}>
          <Stack direction="column" gap={1} grow={1}>
            {controls && !embeddedMini && (
              <div className={styles.controls} data-testid="app-controls">
                <Stack direction="row" gap={1} alignItems="flex-end" wrap="wrap">
                  <GiveFeedbackButton />
                  {controls.map((control) => (
                    <control.Component key={control.state.key} model={control} />
                  ))}
                  <Stack direction="row" gap={0.5}>
                    <PluginInfo getPrometheusBuildInfo={model.getPrometheusBuildInfo} />
                  </Stack>
                </Stack>
              </div>
            )}
            {topScene && (
              embeddedMini ? (
                // Skip URL sync in embeddedMini mode to avoid conflicts with host app
                <div className={styles.body}>
                  <topScene.Component model={topScene} />
                </div>
              ) : (
                <UrlSyncContextProvider
                  scene={topScene}
                  createBrowserHistorySteps={true}
                  updateUrlOnInit={true}
                  namespace={model.state.urlNamespace}
                >
                  <div className={styles.body}>
                    <Stack direction="column" grow={1}>
                      <topScene.Component model={topScene} />
                    </Stack>
                  </div>
                </UrlSyncContextProvider>
              )
            )}
          </Stack>
        </div>
        <drawer.Component model={drawer} />
        {isAddToDashboardModalOpen && AddToDashboardComponent && addToDashboardPanelData && (
          <Modal title={ADD_TO_DASHBOARD_LABEL} isOpen={true} onDismiss={model.closeAddToDashboardModal}>
            {createElement(AddToDashboardComponent as React.ComponentType<AddToDashboardFormProps>, {
              onClose: model.closeAddToDashboardModal,
              buildPanel: () => {
                const expr = String(addToDashboardPanelData?.panel?.targets?.[0]?.expr) ?? '';
                reportExploreMetrics('add_to_dashboard_build_panel', { expr });
                return addToDashboardPanelData.panel;
              },
              timeRange: addToDashboardPanelData.range,
              options: { useAbsolutePath: true },
            })}
          </Modal>
        )}
      </>
    );
  };
}

function getVariableSet(initialDS?: string, metric?: string, initialFilters?: AdHocVariableFilter[]) {
  let variables: SceneVariable[] = [
    new MetricsDrilldownDataSourceVariable({ initialDS }),
    new MetricsVariable(),
    new AdHocFiltersForMetricsVariable(),
    new AdHocFiltersVariable({
      key: VAR_FILTERS,
      name: VAR_FILTERS,
      label: 'Filters',
      addFilterButtonText: 'Add label',
      datasource: trailDS,
      hide: VariableHide.dontHide,
      layout: 'combobox',
      filters: initialFilters ?? [],
      baseFilters: getBaseFiltersForMetric(metric),
      applyMode: 'manual',
      allowCustomValue: true,
      useQueriesAsFilterForOptions: false,
      expressionBuilder: (filters: AdHocVariableFilter[]) => {
        return (
          filters
            // remove any filters that include __name__ key in the expression
            // to prevent the metric name from being set twice in the panel queries and causing an error
            .filter((filter) => filter.key !== '__name__')
            .map((filter) => `${utf8Support(filter.key)}${filter.operator}"${filter.value}"`)
            .join(',')
        );
      },
    }),
    new LabelsVariable(),
  ];

  if (isScopesSupported()) {
    variables.unshift(new ScopesVariable({ enable: true }));
  }

  return new SceneVariableSet({
    variables,
  });
}

function getStyles(theme: GrafanaTheme2, headerHeight: number, trail: DataTrail) {
  const background = getAppBackgroundColor(theme, trail);

  return {
    container: css({
      flexGrow: 1,
      padding: theme.spacing(1, 2),
      position: 'relative',
      background,
    }),
    body: css({
      flexGrow: 1,
      minHeight: 0, // Allow body to shrink below its content size
    }),
    controls: css({
      padding: theme.spacing(1, 0),
      position: 'sticky',
      background,
      zIndex: theme.zIndex.navbarFixed,
      top: headerHeight,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
  };
}

function getBaseFiltersForMetric(metric?: string): AdHocVariableFilter[] {
  if (metric) {
    return [{ key: '__name__', operator: '=', value: metric }];
  }
  return [];
}

function updateAppControlsHeight() {
  const appControls = document.querySelector('[data-testid="app-controls"]');

  if (!appControls) {
    return;
  }

  const { height } = appControls.getBoundingClientRect();
  document.documentElement.style.setProperty('--app-controls-height', `${height}px`);
}

function isScopesSupported(): boolean {
  return Boolean(
    config.featureToggles.scopeFilters &&
      config.featureToggles.enableScopesInMetricsExplore &&
      // Scopes support in Grafana appears to begin with Grafana 12.0.0. We can remove
      // the version check once the `dependencies.grafanaDependency` is updated to 12.0.0 or higher.
      !config.buildInfo.version.startsWith('11.')
  );
}
