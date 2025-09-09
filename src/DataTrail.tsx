import { css } from '@emotion/css';
import { urlUtil, VariableHide, type AdHocVariableFilter, type GrafanaTheme2 } from '@grafana/data';
import { utf8Support } from '@grafana/prometheus';
import { config, useChromeHeaderHeight } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  SceneControlsSpacer,
  SceneDataNode,
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
  VariableValueSelectors,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type SceneObjectUrlValues,
  type SceneObjectWithUrlSync,
  type SceneVariable,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React, { useEffect } from 'react';

import { EventResetSyncYAxis } from 'Breakdown/MetricLabelsList/events/EventResetSyncYAxis';
import { ConfigurePanelForm } from 'GmdVizPanel/components/ConfigurePanelForm/ConfigurePanelForm';
import { EventApplyPanelConfig } from 'GmdVizPanel/components/ConfigurePanelForm/EventApplyPanelConfig';
import { EventCancelConfigurePanel } from 'GmdVizPanel/components/ConfigurePanelForm/EventCancelConfigurePanel';
import { EventConfigurePanel } from 'GmdVizPanel/components/EventConfigurePanel';
import { GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';
import { getMetricType, getMetricTypeSync } from 'GmdVizPanel/matchers/getMetricType';
import { MetricsDrilldownDataSourceVariable } from 'MetricsDrilldownDataSourceVariable';
import { PluginInfo } from 'PluginInfo/PluginInfo';
import { displaySuccess } from 'WingmanDataTrail/helpers/displayStatus';
import { addRecentMetric } from 'WingmanDataTrail/ListControls/MetricsSorter/MetricsSorter';
import { MetricsReducer } from 'WingmanDataTrail/MetricsReducer';
import { MetricsVariable } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';
import { SceneDrawer } from 'WingmanDataTrail/SceneDrawer';

import { DataTrailSettings } from './DataTrailSettings';
import { MetricDatasourceHelper } from './helpers/MetricDatasourceHelper';
import { reportChangeInLabelFilters, reportExploreMetrics } from './interactions';
import { MetricScene } from './MetricScene';
import { MetricSelectedEvent, trailDS, VAR_FILTERS } from './shared';
import { limitAdhocProviders } from './utils';
import { getAppBackgroundColor } from './utils/utils.styles';
import { isAdHocFiltersVariable } from './utils/utils.variables';

export interface DataTrailState extends SceneObjectState {
  topScene?: SceneObject;
  embedded?: boolean;
  controls: SceneObject[];
  settings: DataTrailSettings;
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
}

export class DataTrail extends SceneObjectBase<DataTrailState> implements SceneObjectWithUrlSync {
  private disableReportFiltersInteraction = false;
  private datasourceHelper = new MetricDatasourceHelper(this);

  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['metric'],
  });

  getUrlState(): SceneObjectUrlValues {
    return {
      metric: this.state.metric,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
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
      settings: state.settings ?? new DataTrailSettings({}),
      createdAt: state.createdAt ?? new Date().getTime(),
      dashboardMetrics: {},
      alertingMetrics: {},
      drawer: new SceneDrawer({}),
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.datasourceHelper.init();

    this.updateStateForNewMetric(this.state.metric);
    this.subscribeToEvent(MetricSelectedEvent, (event) => this.handleMetricSelectedEvent(event));

    this.initFilters();
    this.initConfigPrometheusFunction();
  }

  private updateStateForNewMetric(metric?: string) {
    if (!this.state.topScene || metric !== this.state.metric) {
      this.setState({
        metric,
        topScene: metric ? new MetricScene({ metric }) : new MetricsReducer(),
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

      getMetricType(metric, this)
        .catch(() => getMetricTypeSync(metric))
        .then((metricType) => {
          reportExploreMetrics('configure_panel_opened', { metricType });
        });

      const metricType = await getMetricType(metric, this);

      this.state.drawer.open({
        title: 'Configure the Prometheus function',
        subTitle: `${metric} (${metricType})`,
        body: new ConfigurePanelForm({ metric }),
      });
    });

    this.subscribeToEvent(EventCancelConfigurePanel, () => {
      this.state.drawer.close();
    });

    this.subscribeToEvent(EventApplyPanelConfig, async (event) => {
      const { metric, config, restoreDefault } = event.payload;

      getMetricType(metric, this)
        .catch(() => getMetricTypeSync(metric))
        .then((metricType) => {
          if (restoreDefault) {
            reportExploreMetrics('default_panel_config_restored', { metricType });
          } else {
            reportExploreMetrics('panel_config_applied', { metricType, configId: config.id });
          }
        });

      this.state.drawer.close();

      const panelsToUpdate = sceneGraph.findAllObjects(
        this.state.topScene || this,
        (o) => o instanceof GmdVizPanel && o.state.metric === metric && !o.state.queryConfig.groupBy
      ) as GmdVizPanel[];

      const objectsWithSyncYAxisBehavior = sceneGraph.findAllObjects(this.state.topScene || this, (o) =>
        Boolean(o.state.$behaviors?.some((b) => (b as any).__name__ === 'syncYAxis'))
      );

      for (const objectWithSyncYAxisBehavior of objectsWithSyncYAxisBehavior) {
        objectWithSyncYAxisBehavior.publishEvent(new EventResetSyncYAxis({}), true);
      }

      for (const panel of panelsToUpdate) {
        panel.update(config.panelOptions, config.queryOptions);
      }

      displaySuccess([`Configuration successfully ${restoreDefault ? 'restored' : 'applied'} for metric ${metric}!`]);
    });
  }

  private async handleMetricSelectedEvent(event: MetricSelectedEvent) {
    const { metric, urlValues } = event.payload;

    if (metric) {
      addRecentMetric(metric);
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

  public async getPrometheusBuildInfo() {
    return this.datasourceHelper.getPrometheusBuildInfo();
  }

  public async getMetadataForMetric(metric: string) {
    return this.datasourceHelper.getMetadataForMetric(metric);
  }

  public async isNativeHistogram(metric: string) {
    return this.datasourceHelper.isNativeHistogram(metric);
  }

  static readonly Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const { controls, topScene, settings, embedded, drawer } = model.useState();

    const chromeHeaderHeight = useChromeHeaderHeight() ?? 0;
    const headerHeight = embedded ? 0 : chromeHeaderHeight;
    const styles = useStyles2(getStyles, headerHeight, model);

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
          {controls && (
            <div className={styles.controls} data-testid="app-controls">
              {controls.map((control) => (
                <control.Component key={control.state.key} model={control} />
              ))}
              <div className={styles.settingsInfo}>
                <settings.Component model={settings} />
                <PluginInfo model={model} />
              </div>
            </div>
          )}
          {topScene && (
            <UrlSyncContextProvider
              scene={topScene}
              createBrowserHistorySteps={true}
              updateUrlOnInit={true}
              namespace={model.state.urlNamespace}
            >
              <div className={styles.body}>{topScene && <topScene.Component model={topScene} />}</div>
            </UrlSyncContextProvider>
          )}
        </div>
        <drawer.Component model={drawer} />
      </>
    );
  };
}

function getVariableSet(initialDS?: string, metric?: string, initialFilters?: AdHocVariableFilter[]) {
  let variables: SceneVariable[] = [
    new MetricsDrilldownDataSourceVariable({ initialDS }),
    new MetricsVariable(),
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
        // remove any filters that include __name__ key in the expression
        // to prevent the metric name from being set twice in the query and causing an error.
        // also escapes equal signs to prevent invalid queries
        // TODO: proper escaping as Scene does in https://github.com/grafana/scenes/blob/main/packages/scenes/src/variables/utils.ts#L45-L67
        return (
          filters
            .filter((filter) => filter.key !== '__name__')
            // eslint-disable-next-line sonarjs/no-nested-template-literals
            .map((filter) => `${utf8Support(filter.key)}${filter.operator}"${filter.value}"`)
            .join(',')
        );
      },
    }),
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
      display: 'flex',
      gap: theme.spacing(1),
      flexDirection: 'column',
      padding: theme.spacing(1, 2),
      position: 'relative',
      background,
    }),
    body: css({
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0, // Allow body to shrink below its content size
    }),
    controls: css({
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 0),
      alignItems: 'flex-end',
      flexWrap: 'wrap',
      position: 'sticky',
      background,
      zIndex: theme.zIndex.navbarFixed,
      top: headerHeight,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
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
