import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import {
  behaviors,
  sceneGraph,
  SceneObjectBase,
  SceneVariableSet,
  SceneVariableValueChangedEvent,
  type QueryVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { EventQuickSearchChanged } from 'MetricsReducer/list-controls/QuickSearch/EventQuickSearchChanged';
import { QuickSearch } from 'MetricsReducer/list-controls/QuickSearch/QuickSearch';
import { EventMetricsVariableActivated } from 'MetricsReducer/metrics-variables/events/EventMetricsVariableActivated';
import { EventMetricsVariableDeactivated } from 'MetricsReducer/metrics-variables/events/EventMetricsVariableDeactivated';
import { EventMetricsVariableLoaded } from 'MetricsReducer/metrics-variables/events/EventMetricsVariableLoaded';
import {
  FilteredMetricsVariable,
  VAR_FILTERED_METRICS_VARIABLE,
} from 'MetricsReducer/metrics-variables/FilteredMetricsVariable';
import { MetricsVariable, VAR_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/MetricsVariable';
import {
  MetricsVariableFilterEngine,
  type MetricFilters,
} from 'MetricsReducer/metrics-variables/MetricsVariableFilterEngine';
import { MetricsVariableSortEngine } from 'MetricsReducer/metrics-variables/MetricsVariableSortEngine';
import { MetricsList } from 'MetricsReducer/MetricsList/MetricsList';
import { EventFiltersChanged } from 'MetricsReducer/SideBar/sections/MetricsFilterSection/EventFiltersChanged';
import { getAppBackgroundColor } from 'shared/utils/utils.styles';

import { applyRanking } from './ranking/applyRanking';
import { RelatedMetricsRanking } from './ranking/RelatedMetricsRanking';
import { RelatedListControls } from './RelatedListControls';
import { actionViews } from '../../MetricScene/MetricActionBar';
import { getTrailFor } from '../../shared/utils/utils';
import { signalOnQueryComplete } from '../utils/signalOnQueryComplete';

interface RelatedMetricsSceneState extends SceneObjectState {
  metric: string;
  body: MetricsList;
  listControls: RelatedListControls;
  ranking?: RelatedMetricsRanking;
}

export class RelatedMetricsScene extends SceneObjectBase<RelatedMetricsSceneState> {
  constructor({ metric, useJevRanking = false }: { metric: string; useJevRanking?: boolean }) {
    super({
      metric,
      $variables: new SceneVariableSet({
        variables: [new FilteredMetricsVariable()],
      }),
      $behaviors: [new behaviors.SceneQueryController()],
      key: useJevRanking ? 'JevRelatedMetricsScene' : 'RelatedMetricsScene',
      body: new MetricsList({ variableName: VAR_FILTERED_METRICS_VARIABLE }),
      listControls: new RelatedListControls({}),
      ranking: useJevRanking ? new RelatedMetricsRanking(metric) : undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    // make sure we display all the available metrics (see DataTrail.tsx, side bar sections in SideBar.tsx and RecentMetricsSection.tsx)
    const metricsVariable = sceneGraph.findByKeyAndType(this, VAR_METRICS_VARIABLE, MetricsVariable);
    metricsVariable.fetchAllMetrics();

    this.subscribeToEvents(metricsVariable);
  }

  private subscribeToEvents(metricsVariable: MetricsVariable) {
    this.initVariablesFilteringAndSorting();

    // Wait for metrics to load, then signal when queries complete
    const sub = metricsVariable.subscribeToState((state) => {
      if (state.loading === false) {
        sub.unsubscribe();

        const actionView = this.state.ranking ? actionViews.jevRelated : actionViews.related;
        if (this.state.body.isActive) {
          signalOnQueryComplete(this, actionView);
        } else {
          this.state.body.addActivationHandler(() => {
            signalOnQueryComplete(this, actionView);
          });
        }
      }
    });
    this._subs.add(sub);
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
    const { ranking } = this.state;
    const sortMetrics = (key: string, sortEngine: MetricsVariableSortEngine) => {
      sortEngine.sort('related', { metric });
      if (ranking?.state.status !== 'ready') {
        return;
      }
      const variable = sceneGraph.findByKey(this, key) as QueryVariable;
      const metrics = variable.state.options.map((option) => String(option.value));
      const sorted = applyRanking(metrics, ranking.state.candidates, ranking.state.response);
      variable.setState({ options: sorted.map((name) => ({ label: name, value: name })) });
      variable.publishEvent(new SceneVariableValueChangedEvent(variable), true);
    };

    if (ranking) {
      this._subs.add(
        ranking.subscribeToState(() => {
          for (const [key, { sortEngine }] of enginesMap) {
            sortMetrics(key, sortEngine);
          }
        })
      );
    }

    this.subscribeToEvent(EventMetricsVariableLoaded, (event) => {
      // filter  on initial load
      const { key, options } = event.payload;
      const { filterEngine, sortEngine } = enginesMap.get(key)!;

      filterEngine.setInitOptions(options);

      const filters: Partial<MetricFilters> = {
        names: quickSearch.state.value ? [quickSearch.state.value] : [],
      };

      filterEngine.applyFilters(filters, { forceUpdate: true, notify: false });
      // Rank only in the Jev tab, using the full list rather than the search/prefix-filtered subset.
      if (key === VAR_FILTERED_METRICS_VARIABLE) {
        ranking?.start(options.map((option) => String(option.value)));
      }
      sortMetrics(key, sortEngine);
    });

    /* Filters */

    this.subscribeToEvent(EventQuickSearchChanged, (event) => {
      const { searchText } = event.payload;

      for (const [key, { filterEngine, sortEngine }] of enginesMap) {
        filterEngine.applyFilters({ names: searchText ? [searchText] : [] });
        sortMetrics(key, sortEngine);
      }
    });

    this.subscribeToEvent(EventFiltersChanged, (event) => {
      const { type, filters } = event.payload;

      for (const [key, { filterEngine, sortEngine }] of enginesMap) {
        filterEngine.applyFilters({ [type]: filters });
        sortMetrics(key, sortEngine);
      }
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<RelatedMetricsScene>) => {
    const chromeHeaderHeight = useChromeHeaderHeight();
    const trail = getTrailFor(model);
    const styles = useStyles2(getStyles, trail.state.embedded ? 0 : (chromeHeaderHeight ?? 0), trail.state.embedded);
    const { $variables, body, listControls, ranking } = model.useState();

    return (
      <>
        <div className={styles.searchSticky}>
          <listControls.Component model={listControls} />
        </div>
        {ranking && <ranking.Component model={ranking} />}
        <div data-testid="panels-list">
          <body.Component model={body} />
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

function getStyles(theme: GrafanaTheme2, headerHeight: number, embedded?: boolean) {
  return {
    variables: css({
      display: 'none',
    }),
    searchSticky: css({
      margin: theme.spacing(1, 0, 1.5, 0),
      position: 'sticky',
      top: `calc(var(--app-controls-height, 0px) + ${headerHeight}px + var(--action-bar-height, 0px))`,
      zIndex: 10,
      backgroundColor: getAppBackgroundColor(theme, embedded),
      paddingBottom: theme.spacing(1),
    }),
  };
}
