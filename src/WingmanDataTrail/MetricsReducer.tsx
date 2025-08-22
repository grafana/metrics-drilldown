import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import {
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

import { reportExploreMetrics } from 'interactions';

import { MetricSelectedEvent } from '../shared';
import { MetricsGroupByList } from './GroupBy/MetricsGroupByList';
import { MetricsWithLabelValueDataSource } from './GroupBy/MetricsWithLabelValue/MetricsWithLabelValueDataSource';
import { registerRuntimeDataSources } from './helpers/registerRuntimeDataSources';
import { LabelsDataSource, NULL_GROUP_BY_VALUE } from './Labels/LabelsDataSource';
import { LabelsVariable, VAR_WINGMAN_GROUP_BY } from './Labels/LabelsVariable';
import { ListControls } from './ListControls/ListControls';
import { EventSortByChanged } from './ListControls/MetricsSorter/events/EventSortByChanged';
import {
  addRecentMetric,
  MetricsSorter,
  VAR_WINGMAN_SORT_BY,
  type SortingOption,
} from './ListControls/MetricsSorter/MetricsSorter';
import { EventQuickSearchChanged } from './ListControls/QuickSearch/EventQuickSearchChanged';
import { QuickSearch } from './ListControls/QuickSearch/QuickSearch';
import { MetricsList } from './MetricsList/MetricsList';
import { EventMetricsVariableActivated } from './MetricsVariables/EventMetricsVariableActivated';
import { EventMetricsVariableDeactivated } from './MetricsVariables/EventMetricsVariableDeactivated';
import { EventMetricsVariableLoaded } from './MetricsVariables/EventMetricsVariableLoaded';
import { FilteredMetricsVariable, VAR_FILTERED_METRICS_VARIABLE } from './MetricsVariables/FilteredMetricsVariable';
import { MetricsVariableFilterEngine, type MetricFilters } from './MetricsVariables/MetricsVariableFilterEngine';
import { MetricsVariableSortEngine } from './MetricsVariables/MetricsVariableSortEngine';
import { EventFiltersChanged } from './SideBar/sections/MetricsFilterSection/EventFiltersChanged';
import { MetricsFilterSection } from './SideBar/sections/MetricsFilterSection/MetricsFilterSection';
import { SideBar } from './SideBar/SideBar';

interface MetricsReducerState extends SceneObjectState {
  listControls: ListControls;
  sidebar: SideBar;
  body: SceneObjectBase;
  enginesMap: Map<string, { filterEngine: MetricsVariableFilterEngine; sortEngine: MetricsVariableSortEngine }>;
}

export class MetricsReducer extends SceneObjectBase<MetricsReducerState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_WINGMAN_GROUP_BY],
    onReferencedVariableValueChanged: (variable) => {
      this.updateBasedOnGroupBy((variable as LabelsVariable).state.value as string);
    },
  });

  public constructor() {
    super({
      $variables: new SceneVariableSet({
        variables: [new FilteredMetricsVariable(), new LabelsVariable()],
      }),
      listControls: new ListControls({}),
      sidebar: new SideBar({}),
      body: new MetricsList({ variableName: VAR_FILTERED_METRICS_VARIABLE }) as unknown as SceneObjectBase,
      enginesMap: new Map(),
    });

    registerRuntimeDataSources([new LabelsDataSource(), new MetricsWithLabelValueDataSource()]);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const groupByValue = (sceneGraph.lookupVariable(VAR_WINGMAN_GROUP_BY, this) as LabelsVariable).state
      .value as string;

    this.updateBasedOnGroupBy(groupByValue);

    this.subscribeToEvents();
  }

  private updateBasedOnGroupBy(groupByValue: string) {
    const hasGroupByValue = Boolean(groupByValue && groupByValue !== NULL_GROUP_BY_VALUE);

    sceneGraph.findByKeyAndType(this, 'quick-search', QuickSearch).toggleCountsDisplay(!hasGroupByValue);

    this.setState({
      body: hasGroupByValue
        ? (new MetricsGroupByList({ labelName: groupByValue }) as unknown as SceneObjectBase)
        : (new MetricsList({ variableName: VAR_FILTERED_METRICS_VARIABLE }) as unknown as SceneObjectBase),
    });
  }

  private subscribeToEvents() {
    this.initVariablesFilteringAndSorting();

    this._subs.add(
      this.subscribeToEvent(MetricSelectedEvent, (event) => {
        if (event.payload !== undefined) {
          addRecentMetric(event.payload);
        }
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
    this._subs.add(
      this.subscribeToEvent(EventMetricsVariableActivated, (event) => {
        // register engines
        const { key } = event.payload;
        const filteredMetricsVariable = sceneGraph.findByKey(this, key) as QueryVariable;

        this.state.enginesMap.set(key, {
          filterEngine: new MetricsVariableFilterEngine(filteredMetricsVariable),
          sortEngine: new MetricsVariableSortEngine(filteredMetricsVariable),
        });
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventMetricsVariableDeactivated, (event) => {
        // unregister engines
        this.state.enginesMap.delete(event.payload.key);
      })
    );

    const quickSearch = sceneGraph.findByKeyAndType(this, 'quick-search', QuickSearch);
    const filterSections = sceneGraph.findAllObjects(
      this,
      (o) => o instanceof MetricsFilterSection
    ) as MetricsFilterSection[];
    const metricsSorter = sceneGraph.findByKeyAndType(this, 'metrics-sorter', MetricsSorter);
    const sortByVariable = metricsSorter.state.$variables.getByName(VAR_WINGMAN_SORT_BY) as CustomVariable;

    this._subs.add(
      this.subscribeToEvent(EventMetricsVariableLoaded, (event) => {
        // filter and sort on initial load
        const { key, options } = event.payload;
        const { filterEngine, sortEngine } = this.state.enginesMap.get(key)!;

        filterEngine.setInitOptions(options);

        const filters: Partial<MetricFilters> = {
          names: quickSearch.state.value ? [quickSearch.state.value] : [],
        };

        for (const filterSection of filterSections) {
          filters[filterSection.state.type] = filterSection.state.selectedGroups.map((g) => g.value);
        }

        filterEngine.applyFilters(filters, { forceUpdate: true, notify: false });
        sortEngine.sort(sortByVariable.state.value as SortingOption);
      })
    );

    /* Filters */

    this._subs.add(
      this.subscribeToEvent(EventQuickSearchChanged, (event) => {
        const { searchText } = event.payload;

        for (const [, { filterEngine, sortEngine }] of this.state.enginesMap) {
          filterEngine.applyFilters({ names: searchText ? [searchText] : [] });
          sortEngine.sort(sortByVariable.state.value as SortingOption);
        }
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventFiltersChanged, (event) => {
        const { type, filters } = event.payload;

        for (const [, { filterEngine, sortEngine }] of this.state.enginesMap) {
          filterEngine.applyFilters({ [type]: filters });
          sortEngine.sort(sortByVariable.state.value as SortingOption);
        }
      })
    );

    /* Sorting */

    this._subs.add(
      this.subscribeToEvent(EventSortByChanged, (event) => {
        const { sortBy } = event.payload;
        reportExploreMetrics('sorting_changed', { from: 'metrics-reducer', sortBy });

        for (const [, { sortEngine }] of this.state.enginesMap) {
          sortEngine.sort(sortBy);
        }
      })
    );
  }

  public static readonly Component = ({ model }: SceneComponentProps<MetricsReducer>) => {
    const chromeHeaderHeight = useChromeHeaderHeight() ?? 0;
    const styles = useStyles2(getStyles, chromeHeaderHeight);

    const { $variables, body, listControls, sidebar } = model.useState();

    return (
      <>
        <div className={styles.listControls} data-testid="list-controls">
          <listControls.Component model={listControls} />
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
      </>
    );
  };
}

// the height of header between Grafana's chrome header and the metrics list container.
const APP_HEADER_HEIGHT = 144;

function getStyles(theme: GrafanaTheme2, chromeHeaderHeight: number) {
  return {
    listControls: css({
      marginBottom: theme.spacing(1.5),
    }),
    body: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
      height: `calc(100vh - ${chromeHeaderHeight + APP_HEADER_HEIGHT}px)`,
    }),
    list: css({
      width: '100%',
      overflowY: 'auto',
    }),
    sidebar: css({
      flex: '0 0 auto',
      overflowY: 'auto',
    }),
    variables: css({
      display: 'none',
    }),
  };
}
