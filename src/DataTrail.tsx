import { css } from '@emotion/css';
import { VariableHide, type AdHocVariableFilter, type GrafanaTheme2 } from '@grafana/data';
import { utf8Support, type PromQuery } from '@grafana/prometheus';
import { config, useChromeHeaderHeight } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  SceneControlsSpacer,
  sceneGraph,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  SceneReactObject,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  ScopesVariable,
  UrlSyncContextProvider,
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
import React, { useEffect } from 'react';

import { ConfigurePanelAction } from 'GmdVizPanel/components/ConfigurePanelAction';
import { ConfigurePanelForm } from 'GmdVizPanel/components/ConfigurePanelForm/ConfigurePanelForm';
import { EventApplyPanelConfig } from 'GmdVizPanel/components/ConfigurePanelForm/EventApplyPanelConfig';
import { EventCancelConfigurePanel } from 'GmdVizPanel/components/ConfigurePanelForm/EventCancelConfigurePanel';
import { EventConfigurePanel } from 'GmdVizPanel/components/EventConfigurePanel';
import { GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';
import { getMetricType } from 'GmdVizPanel/matchers/getMetricType';
import { MetricsDrilldownDataSourceVariable } from 'MetricsDrilldownDataSourceVariable';
import { PluginInfo } from 'PluginInfo/PluginInfo';
import { displaySuccess } from 'WingmanDataTrail/helpers/displayStatus';
import { MetricsReducer } from 'WingmanDataTrail/MetricsReducer';
import { MetricsVariable } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';
import { SceneDrawer } from 'WingmanDataTrail/SceneDrawer';

import { DataTrailSettings } from './DataTrailSettings';
import { MetricDatasourceHelper } from './helpers/MetricDatasourceHelper';
import { reportChangeInLabelFilters, reportExploreMetrics } from './interactions';
import { MetricScene } from './MetricScene';
import { MetricSelectedEvent, trailDS, VAR_FILTERS } from './shared';
import { getTrailStore } from './TrailStore/TrailStore';
import { limitAdhocProviders } from './utils';
import { isSceneQueryRunner } from './utils/utils.queries';
import { getAppBackgroundColor } from './utils/utils.styles';
import { isAdHocFiltersVariable } from './utils/utils.variables';

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

  // Synced with url
  metric?: string;
  metricSearch?: string;
  nativeHistogramMetric: string;

  trailActivated: boolean; // this indicates that the trail has been updated by metric or filter selected
  urlNamespace?: string; // optional namespace for url params, to avoid conflicts with other plugins in embedded mode

  drawer: SceneDrawer;
}

export class DataTrail extends SceneObjectBase<DataTrailState> implements SceneObjectWithUrlSync {
  private _addingFilterWithoutReportingInteraction = false;
  private datasourceHelper = new MetricDatasourceHelper(this);

  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['metric', 'metricSearch', 'nativeHistogramMetric'],
  });

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
    } else if (values.metric == null && !this.state.embedded) {
      stateUpdate.metric = undefined;
      stateUpdate.topScene = new MetricsReducer();
    }

    if (typeof values.metricSearch === 'string') {
      stateUpdate.metricSearch = values.metricSearch;
    } else if (values.metric == null) {
      stateUpdate.metricSearch = undefined;
    }

    this.setState(stateUpdate);
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
      pluginInfo: new SceneReactObject({ component: PluginInfo }),
      createdAt: state.createdAt ?? new Date().getTime(),
      dashboardMetrics: {},
      alertingMetrics: {},
      nativeHistogramMetric: state.nativeHistogramMetric ?? '',
      trailActivated: state.trailActivated ?? false,
      drawer: new SceneDrawer({}),
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.datasourceHelper.init();

    this.subscribeToConfigEvents();

    this.setState({ trailActivated: true });

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

      // we ensure that, in the MetricsReducer, the Ad Hoc filters will display all the label names and values and
      // we ensure that, in the MetricScene, the queries in the Scene graph will be considered and used as a filter
      // to fetch label names and values
      filtersVariable?.setState({
        useQueriesAsFilterForOptions: Boolean(this.state.metric),
      });

      this.subscribeToState((newState, prevState) => {
        if (newState.metric !== prevState.metric) {
          filtersVariable?.setState({
            useQueriesAsFilterForOptions: Boolean(newState.metric),
          });

          // ensure that when using browser nav, we close the drawer
          this.state.drawer.close();
        }
      });
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

  private async subscribeToConfigEvents() {
    this._subs.add(
      this.subscribeToEvent(EventConfigurePanel, async (event) => {
        const { metric } = event.payload;

        reportExploreMetrics('configure_panel_opened', { metricType: getMetricType(metric) });

        const metadata = await this.getMetadataForMetric(metric);

        this.state.drawer.open({
          title: 'Configure the Prometheus function',
          subTitle: `${metric} ${metadata ? ` (${metadata.type})` : ''}`, // eslint-disable-line sonarjs/no-nested-template-literals
          body: new ConfigurePanelForm({ metric }),
        });
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventCancelConfigurePanel, () => {
        this.state.drawer.close();
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventApplyPanelConfig, (event) => {
        const { metric, config, restoreDefault } = event.payload;

        if (restoreDefault) {
          reportExploreMetrics('default_panel_config_restored', { metricType: getMetricType(metric) });
        } else {
          reportExploreMetrics('panel_config_applied', { metricType: getMetricType(metric), configId: config.id });
        }

        this.state.drawer.close();

        const panelsToUpdate = sceneGraph.findAllObjects(
          this.state.topScene || this,
          (o) =>
            o instanceof GmdVizPanel &&
            o.state.metric === metric &&
            Boolean(sceneGraph.findDescendents(o, ConfigurePanelAction).length === 1)
        ) as GmdVizPanel[];

        for (const panel of panelsToUpdate) {
          panel.update(config.panelOptions, config.queryOptions);
        }

        displaySuccess([`Configuration successfully ${restoreDefault ? 'restored' : 'applied'} for metric ${metric}!`]);
      })
    );
  }

  /**
   * Assuming that the change in filter was already reported with a cause other than `'adhoc_filter'`,
   * this will modify the adhoc filter variable and prevent the automatic reporting which would
   * normally occur through the call to `reportChangeInLabelFilters`.
   */
  public addFilterWithoutReportingInteraction(filter: AdHocVariableFilter) {
    const variable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (!isAdHocFiltersVariable(variable)) {
      return;
    }

    this._addingFilterWithoutReportingInteraction = true;
    variable.setState({ filters: [...variable.state.filters, filter] });
    this._addingFilterWithoutReportingInteraction = false;
  }

  public getMetadataForMetric(metric: string) {
    return this.datasourceHelper.getMetadataForMetric(metric);
  }

  public async isNativeHistogram(metric: string) {
    return this.datasourceHelper.isNativeHistogram(metric);
  }

  private async _handleMetricSelectedEvent(evt: MetricSelectedEvent) {
    const metric = evt.payload ?? '';

    // Add metric to adhoc filters baseFilter
    const filterVar = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (isAdHocFiltersVariable(filterVar)) {
      filterVar.setState({
        baseFilters: getBaseFiltersForMetric(evt.payload),
      });
    }

    const nativeHistogramMetric = await this.isNativeHistogram(metric);

    this._urlSync.performBrowserHistoryAction(() => {
      this.setState(this.getSceneUpdatesForNewMetricValue(metric, nativeHistogramMetric));
    });
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

  static readonly Component = ({ model }: SceneComponentProps<DataTrail>) => {
    const { controls, topScene, settings, pluginInfo, embedded, drawer } = model.useState();

    const chromeHeaderHeight = useChromeHeaderHeight() ?? 0;
    const headerHeight = embedded ? 0 : chromeHeaderHeight;
    const styles = useStyles2(getStyles, headerHeight, model);

    useEffect(() => {
      const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, model);
      const datasourceHelper = model.datasourceHelper;
      limitAdhocProviders(model, filtersVariable, datasourceHelper);
    }, [model]);

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
                <pluginInfo.Component model={pluginInfo} />
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

export function getTopSceneFor(metric?: string, nativeHistogram = false) {
  if (metric) {
    return new MetricScene({ metric, nativeHistogram });
  } else {
    return new MetricsReducer();
  }
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
            .map((filter) => `${utf8Support(filter.key)}${filter.operator}"${filter.value.replaceAll('=', `\=`)}"`)
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
