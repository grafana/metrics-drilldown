import { css } from '@emotion/css';
import { DashboardCursorSync, type GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import {
  behaviors,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  SceneVariableSet,
  VariableDependencyConfig,
  type CustomVariable,
  type QueryVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { getColorByIndex, getTrailFor } from 'utils';

import { MetricsGroupByList } from './GroupBy/MetricsGroupByList';
import { MetricsWithLabelValueDataSource } from './GroupBy/MetricsWithLabelValue/MetricsWithLabelValueDataSource';
import { HeaderControls } from './HeaderControls/HeaderControls';
import { EventSortByChanged } from './HeaderControls/MetricsSorter/EventSortByChanged';
import { MetricsSorter, VAR_WINGMAN_SORT_BY, type SortingOption } from './HeaderControls/MetricsSorter/MetricsSorter';
import { EventQuickSearchChanged } from './HeaderControls/QuickSearch/EventQuickSearchChanged';
import { QuickSearch } from './HeaderControls/QuickSearch/QuickSearch';
import { registerRuntimeDataSources } from './helpers/registerRuntimeDataSources';
import { LabelsDataSource, NULL_GROUP_BY_VALUE } from './Labels/LabelsDataSource';
import { LabelsVariable, VAR_WINGMAN_GROUP_BY } from './Labels/LabelsVariable';
import { GRID_TEMPLATE_COLUMNS, SimpleMetricsList } from './MetricsList/SimpleMetricsList';
import { EventMetricsVariableActivated } from './MetricsVariables/EventMetricsVariableActivated';
import { EventMetricsVariableDeactivated } from './MetricsVariables/EventMetricsVariableDeactivated';
import { EventMetricsVariableLoaded } from './MetricsVariables/EventMetricsVariableLoaded';
import { EventMetricsVariableUpdated } from './MetricsVariables/EventMetricsVariableUpdated';
import { FilteredMetricsVariable } from './MetricsVariables/FilteredMetricsVariable';
import { MetricsVariable } from './MetricsVariables/MetricsVariable';
import { MetricsVariableFilterEngine } from './MetricsVariables/MetricsVariableFilterEngine';
import { MetricsVariableSortEngine } from './MetricsVariables/MetricsVariableSortEngine';
import { ApplyAction } from './MetricVizPanel/actions/ApplyAction';
import { ConfigureAction } from './MetricVizPanel/actions/ConfigureAction';
import { EventApplyFunction } from './MetricVizPanel/actions/EventApplyFunction';
import { EventConfigureFunction } from './MetricVizPanel/actions/EventConfigureFunction';
import { METRICS_VIZ_PANEL_HEIGHT_SMALL, MetricVizPanel } from './MetricVizPanel/MetricVizPanel';
import { SceneDrawer } from './SceneDrawer';
import { EventFiltersChanged } from './SideBar/EventFiltersChanged';
import { SideBar } from './SideBar/SideBar';
interface MetricsReducerState extends SceneObjectState {
  headerControls: HeaderControls;
  sidebar: SideBar;
  body: SceneObjectBase;
  drawer: SceneDrawer;
}

export class MetricsReducer extends SceneObjectBase<MetricsReducerState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_WINGMAN_GROUP_BY],
    onReferencedVariableValueChanged: (variable) => {
      this.updateBodyBasedOnGroupBy((variable as LabelsVariable).state.value as string);
    },
  });

  public constructor() {
    super({
      $variables: new SceneVariableSet({
        variables: [new MetricsVariable(), new FilteredMetricsVariable(), new LabelsVariable()],
      }),
      headerControls: new HeaderControls({}),
      sidebar: new SideBar({}),
      body: new SimpleMetricsList() as unknown as SceneObjectBase,
      drawer: new SceneDrawer({}),
    });

    registerRuntimeDataSources([new LabelsDataSource(), new MetricsWithLabelValueDataSource()]);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.updateBodyBasedOnGroupBy(
      (sceneGraph.lookupVariable(VAR_WINGMAN_GROUP_BY, this) as LabelsVariable).state.value as string
    );

    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    this.initVariablesFilteringAndSorting();

    this._subs.add(
      this.subscribeToEvent(EventConfigureFunction, (event) => {
        this.openDrawer(event.payload.metricName);
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventApplyFunction, (event) => {
        this.state.drawer.close();
      })
    );
  }

  /**
   * The centralized filtering and sorting mechanism implemented here is decoupled via the usage of events.
   * In order to work, the variables to be filtered/sorted must emit lifecycle events.
   * This is done via the `withLifecycleEvents` decorator function.
   *
   * For example, check the `FilteredMetricsVariable` class.
   */
  private initVariablesFilteringAndSorting() {
    const filterEnginesMap = new Map<string, MetricsVariableFilterEngine>();
    const sortEnginesMap = new Map<string, MetricsVariableSortEngine>();

    this._subs.add(
      this.subscribeToEvent(EventMetricsVariableActivated, (event) => {
        // register engines
        const { key } = event.payload;
        const filteredMetricsVariable = sceneGraph.findByKey(this, key) as QueryVariable;

        filterEnginesMap.set(key, new MetricsVariableFilterEngine(filteredMetricsVariable));
        sortEnginesMap.set(key, new MetricsVariableSortEngine(filteredMetricsVariable));
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventMetricsVariableDeactivated, (event) => {
        // unregister engines
        sortEnginesMap.delete(event.payload.key);
        filterEnginesMap.delete(event.payload.key);
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventMetricsVariableLoaded, (event) => {
        // filter and sort on initial load
        const { key, options } = event.payload;
        const filterEngine = filterEnginesMap.get(key)!;
        const quickSearch = sceneGraph.findByKeyAndType(this, 'quick-search', QuickSearch);
        const sideBar = sceneGraph.findByKeyAndType(this, 'sidebar', SideBar);

        filterEngine.setInitOptions(options);

        filterEngine.applyFilters(
          {
            names: quickSearch.state.value ? [quickSearch.state.value] : [],
            prefixes: sideBar.state.selectedMetricPrefixes,
            suffixes: sideBar.state.selectedMetricSuffixes,
          },
          { notify: false }
        );

        const sortEngine = sortEnginesMap.get(event.payload.key)!;
        const metricsSorter = sceneGraph.findByKeyAndType(this, 'metrics-sorter', MetricsSorter);
        const sortByVariable = metricsSorter.state.$variables.getByName(VAR_WINGMAN_SORT_BY) as CustomVariable;

        sortEngine.sort(sortByVariable.state.value as SortingOption);
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventMetricsVariableUpdated, (event) => {
        // sort whenever the variable options change
        const { key } = event.payload;
        const sortEngine = sortEnginesMap.get(key)!;
        const metricsSorter = sceneGraph.findByKeyAndType(this, 'metrics-sorter', MetricsSorter);
        const sortByVariable = metricsSorter.state.$variables.getByName(VAR_WINGMAN_SORT_BY) as CustomVariable;

        sortEngine.sort(sortByVariable.state.value as SortingOption);
      })
    );

    /* Filters */

    this._subs.add(
      this.subscribeToEvent(EventQuickSearchChanged, (event) => {
        const { searchText } = event.payload;

        for (const [, filterEngine] of filterEnginesMap) {
          filterEngine.applyFilters({ names: searchText ? [searchText] : [] });
        }
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventFiltersChanged, (event) => {
        const { type, filters } = event.payload;

        for (const [, filterEngine] of filterEnginesMap) {
          filterEngine.applyFilters({ [type]: filters });
        }
      })
    );

    /* Sorting */

    this._subs.add(
      this.subscribeToEvent(EventSortByChanged, (event) => {
        const { sortBy } = event.payload;

        for (const [, sortEngine] of sortEnginesMap) {
          sortEngine.sort(sortBy);
        }
      })
    );
  }

  private updateBodyBasedOnGroupBy(groupByValue: string) {
    this.setState({
      body:
        !groupByValue || groupByValue === NULL_GROUP_BY_VALUE
          ? (new SimpleMetricsList() as unknown as SceneObjectBase)
          : (new MetricsGroupByList({ labelName: groupByValue }) as unknown as SceneObjectBase),
    });
  }

  private openDrawer(metricName: string) {
    this.state.drawer.open({
      title: 'Choose a new Prometheus function',
      subTitle: metricName,
      body: new SceneCSSGridLayout({
        templateColumns: GRID_TEMPLATE_COLUMNS,
        autoRows: METRICS_VIZ_PANEL_HEIGHT_SMALL,
        isLazy: true,
        $behaviors: [
          new behaviors.CursorSync({
            key: 'metricCrosshairSync',
            sync: DashboardCursorSync.Crosshair,
          }),
        ],
        children: ConfigureAction.PROMETHEUS_FN_OPTIONS.map((option, colorIndex) => {
          const trail = getTrailFor(this);
          const isNativeHistogram = trail.isNativeHistogram(metricName);

          return new SceneCSSGridItem({
            body: new MetricVizPanel({
              title: option.label,
              metricName,
              color: getColorByIndex(colorIndex),
              prometheusFunction: option.value,
              height: METRICS_VIZ_PANEL_HEIGHT_SMALL,
              hideLegend: true,
              highlight: colorIndex === 1,
              isNativeHistogram,
              headerActions: [
                new ApplyAction({
                  metricName,
                  prometheusFunction: option.value,
                  disabled: colorIndex === 1,
                }),
              ],
            }),
          });
        }),
      }),
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsReducer>) => {
    const chromeHeaderHeight = useChromeHeaderHeight() ?? 0;
    const styles = useStyles2(getStyles, chromeHeaderHeight);

    const { $variables, body, headerControls, drawer, sidebar } = model.useState();

    return (
      <>
        <div className={styles.headerControls} data-testid="header-controls">
          <headerControls.Component model={headerControls} />
        </div>
        <div className={styles.body}>
          <div className={styles.sidebar} data-testid="sidebar">
            <sidebar.Component model={sidebar} />
          </div>
          <div className={styles.list}>
            <body.Component model={body} />
          </div>
        </div>
        <div className={styles.variables}>
          {$variables?.state.variables.map((variable) => (
            <variable.Component key={variable.state.name} model={variable} />
          ))}
        </div>
        <drawer.Component model={drawer} />
      </>
    );
  };
}

function getStyles(theme: GrafanaTheme2, chromeHeaderHeight: number) {
  return {
    headerControls: css({
      marginBottom: theme.spacing(1.5),
    }),
    body: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
      height: `calc(100vh - ${chromeHeaderHeight + 186}px)`,
    }),
    list: css({
      width: '100%',
      overflowY: 'auto',
    }),
    sidebar: css({
      flex: '0 0 320px',
      overflowY: 'hidden',
    }),
    variables: css({
      display: 'none',
    }),
  };
}
