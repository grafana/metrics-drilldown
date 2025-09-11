import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
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

import { type DataTrail } from 'DataTrail';
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
import { MetricsVariable } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';
import {
  MetricsVariableFilterEngine,
  type MetricFilters,
} from 'WingmanDataTrail/MetricsVariables/MetricsVariableFilterEngine';
import { MetricsVariableSortEngine } from 'WingmanDataTrail/MetricsVariables/MetricsVariableSortEngine';
import { EventFiltersChanged } from 'WingmanDataTrail/SideBar/sections/MetricsFilterSection/EventFiltersChanged';

import { getTrailFor } from '../utils';
import { RelatedListControls } from './RelatedListControls';
import { getAppBackgroundColor } from '../utils/utils.styles';

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
        variables: [new MetricsVariable(), new FilteredMetricsVariable()],
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

    this._subs.add(
      this.subscribeToEvent(EventMetricsVariableActivated, (event) => {
        // register engines
        const { key } = event.payload;
        const filteredMetricsVariable = sceneGraph.findByKey(this, key) as QueryVariable;

        enginesMap.set(key, {
          filterEngine: new MetricsVariableFilterEngine(filteredMetricsVariable),
          sortEngine: new MetricsVariableSortEngine(filteredMetricsVariable),
        });
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventMetricsVariableDeactivated, (event) => {
        // unregister engines
        enginesMap.delete(event.payload.key);
      })
    );

    const quickSearch = sceneGraph.findByKeyAndType(this, 'quick-search', QuickSearch);

    this._subs.add(
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
      })
    );

    /* Filters */

    this._subs.add(
      this.subscribeToEvent(EventQuickSearchChanged, (event) => {
        const { searchText } = event.payload;

        for (const [, { filterEngine, sortEngine }] of enginesMap) {
          filterEngine.applyFilters({ names: searchText ? [searchText] : [] });
          sortEngine.sort('related', { metric });
        }
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventFiltersChanged, (event) => {
        const { type, filters } = event.payload;

        for (const [, { filterEngine, sortEngine }] of enginesMap) {
          filterEngine.applyFilters({ [type]: filters });
          sortEngine.sort('related', { metric });
        }
      })
    );
  }

  public static readonly Component = ({ model }: SceneComponentProps<RelatedMetricsScene>) => {
    const chromeHeaderHeight = useChromeHeaderHeight();
    const trail = getTrailFor(model);
    const styles = useStyles2(getStyles, trail.state.embedded ? 0 : chromeHeaderHeight ?? 0, trail);
    const { $variables, body, listControls } = model.useState();

    return (
      <>
        <div className={styles.searchSticky}>
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

function getStyles(theme: GrafanaTheme2, headerHeight: number, trail: DataTrail) {
  return {
    body: css({}),
    list: css({}),
    variables: css({
      display: 'none',
    }),
    searchSticky: css({
      margin: theme.spacing(1, 0, 1.5, 0),
      position: 'sticky',
      background: getAppBackgroundColor(theme, trail),
      zIndex: 10,
      paddingBottom: theme.spacing(1),
      top: `calc(var(--app-controls-height, 0px) + ${headerHeight}px + var(--action-bar-height, 0px))`,
    }),
  };
}
