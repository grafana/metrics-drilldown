import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  SceneVariableSet,
  type QueryVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { EventQuickSearchChanged } from 'WingmanDataTrail/ListControls/QuickSearch/EventQuickSearchChanged';
import { QuickSearch } from 'WingmanDataTrail/ListControls/QuickSearch/QuickSearch';
import { MetricsList } from 'WingmanDataTrail/MetricsList/MetricsList';
import { EventMetricsVariableActivated } from 'WingmanDataTrail/MetricsVariables/EventMetricsVariableActivated';
import { EventMetricsVariableDeactivated } from 'WingmanDataTrail/MetricsVariables/EventMetricsVariableDeactivated';
import { EventMetricsVariableLoaded } from 'WingmanDataTrail/MetricsVariables/EventMetricsVariableLoaded';
import {
  FilteredMetricsVariable,
  VAR_FILTERED_METRICS_VARIABLE,
} from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import {
  MetricsVariableFilterEngine,
  type MetricFilters,
} from 'WingmanDataTrail/MetricsVariables/MetricsVariableFilterEngine';
import { MetricsVariableSortEngine } from 'WingmanDataTrail/MetricsVariables/MetricsVariableSortEngine';
import { EventFiltersChanged } from 'WingmanDataTrail/SideBar/sections/MetricsFilterSection/EventFiltersChanged';

import { RelatedListControls } from './RelatedListControls';

interface RelatedMetricsSceneState extends SceneObjectState {
  metric: string;
  body: MetricsList;
  listControls: RelatedListControls;
}

export class RelatedMetricsScene extends SceneObjectBase<RelatedMetricsSceneState> {
  constructor({ metric }: { metric: RelatedMetricsSceneState['metric'] }) {
    super({
      metric,
      $variables: new SceneVariableSet({
        variables: [new FilteredMetricsVariable()],
      }),
      key: 'RelatedMetricsScene',
      body: new MetricsList({ variableName: VAR_FILTERED_METRICS_VARIABLE }),
      listControls: new RelatedListControls({}),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    this.initVariablesFilteringAndSorting();
  }

  /**
   * The centralized filtering mechanism implemented here is decoupled via the usage of events.
   * In order to work, the variables to be filtered/sorted must emit lifecycle events.
   * This is done via the `withLifecycleEvents` decorator function.
   *
   * For example, check the `FilteredMetricsVariable` class.
   */
  private initVariablesFilteringAndSorting() {
    const { metric } = this.state;

    const enginesMap = new Map<
      string,
      { filterEngine: MetricsVariableFilterEngine; sortEngine: MetricsVariableSortEngine }
    >();

    this.subscribeToEvent(EventMetricsVariableActivated, (event) => {
      // register engines
      const { key } = event.payload;
      const filteredMetricsVariable = sceneGraph.findByKey(this, key) as QueryVariable;

      enginesMap.set(key, {
        filterEngine: new MetricsVariableFilterEngine(filteredMetricsVariable),
        sortEngine: new MetricsVariableSortEngine(filteredMetricsVariable),
      });
    });

    this.subscribeToEvent(EventMetricsVariableDeactivated, (event) => {
      // unregister engines
      enginesMap.delete(event.payload.key);
    });

    const quickSearch = sceneGraph.findByKeyAndType(this, 'quick-search', QuickSearch);

    this.subscribeToEvent(EventMetricsVariableLoaded, (event) => {
      // filter  on initial load
      const { key, options } = event.payload;
      const { filterEngine, sortEngine } = enginesMap.get(key)!;

      filterEngine.setInitOptions(options);

      const filters: Partial<MetricFilters> = {
        names: quickSearch.state.value ? [quickSearch.state.value] : [],
      };

      filterEngine.applyFilters(filters, { forceUpdate: true, notify: false });
      sortEngine.sort('related', { metric });
    });

    /* Filters */

    this.subscribeToEvent(EventQuickSearchChanged, (event) => {
      const { searchText } = event.payload;

      for (const [, { filterEngine, sortEngine }] of enginesMap) {
        filterEngine.applyFilters({ names: searchText ? [searchText] : [] });
        sortEngine.sort('related', { metric });
      }
    });

    this.subscribeToEvent(EventFiltersChanged, (event) => {
      const { type, filters } = event.payload;

      for (const [, { filterEngine, sortEngine }] of enginesMap) {
        filterEngine.applyFilters({ [type]: filters });
        sortEngine.sort('related', { metric });
      }
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<RelatedMetricsScene>) => {
    const styles = useStyles2(getStyles);
    const { $variables, body, listControls } = model.useState();

    return (
      <>
        <div className={styles.listControls}>
          <listControls.Component model={listControls} />
        </div>
        <div className={styles.body}>
          <div className={styles.list} data-testid="panels-list">
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

function getStyles(theme: GrafanaTheme2) {
  return {
    body: css({}),
    list: css({}),
    listControls: css({
      margin: theme.spacing(1, 0, 1.5, 0),
    }),
    variables: css({
      display: 'none',
    }),
  };
}
