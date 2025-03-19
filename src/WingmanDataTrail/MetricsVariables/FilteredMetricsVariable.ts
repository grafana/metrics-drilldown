import { sceneGraph, type CustomVariable, type MultiValueVariable } from '@grafana/scenes';
import { isEqual } from 'lodash';

import { VAR_FILTERS } from 'shared';
import { EventSortByChanged } from 'WingmanDataTrail/HeaderControls/MetricsSorter/EventSortByChanged';
import {
  MetricsSorter,
  VAR_WINGMAN_SORT_BY,
  type SortingOption,
} from 'WingmanDataTrail/HeaderControls/MetricsSorter/MetricsSorter';
import { EventQuickSearchChanged } from 'WingmanDataTrail/HeaderControls/QuickSearch/EventQuickSearchChanged';
import { QuickSearch } from 'WingmanDataTrail/HeaderControls/QuickSearch/QuickSearch';
import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';

import { MetricsVariable } from './MetricsVariable';
import { MetricsVariableFilterEngine, type MetricFilters } from './MetricsVariableFilterEngine';
import { MetricsVariableSortEngine } from './MetricsVariableSortEngine';
export const VAR_FILTERED_METRICS_VARIABLE = 'filtered-metrics-wingman';

export class FilteredMetricsVariable extends MetricsVariable {
  private filterEngine: MetricsVariableFilterEngine;
  private sortEngine: MetricsVariableSortEngine;

  constructor() {
    super({
      name: VAR_FILTERED_METRICS_VARIABLE,
      label: 'Filtered Metrics',
    });

    this.filterEngine = new MetricsVariableFilterEngine(this as unknown as MultiValueVariable);
    this.sortEngine = new MetricsVariableSortEngine(this as unknown as MultiValueVariable);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  protected onActivate() {
    const quickSearch = sceneGraph.findByKeyAndType(this, 'quick-search', QuickSearch);

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.loading === false && prevState.loading === true) {
          this.filterEngine.setInitOptions(newState.options);

          // TODO: use events publishing and subscribe in the main Wingman Scene?
          this.filterEngine.applyFilters({ names: quickSearch.state.value ? [quickSearch.state.value] : [] }, false);
          // this.sortEngine.sort(sortByVariable.state.value as SortingOption);
          return;
        }

        // if (!isEqual(newState.options, prevState.options)) {
        //   this.sortEngine.sort(sortByVariable.state.value as SortingOption);
        //   return;
        // }
      })
    );

    this._subs.add(
      quickSearch.subscribeToEvent(EventQuickSearchChanged, (event) => {
        this.filterEngine.applyFilters({
          names: event.payload.searchText ? [event.payload.searchText] : [],
        });
      })
    );

    // supports the different variants / prevents runtime errors in the onboard screen
    try {
      const metricsSorter = sceneGraph.findByKeyAndType(this, 'metrics-sorter', MetricsSorter);
      const sortByVariable = metricsSorter.state.$variables.getByName(VAR_WINGMAN_SORT_BY) as CustomVariable;

      this._subs.add(
        metricsSorter.subscribeToEvent(EventSortByChanged, (event) => {
          this.sortEngine.sort(event.payload.sortBy);
        })
      );

      this._subs.add(
        this.subscribeToState((newState, prevState) => {
          if (newState.loading === false && prevState.loading === true) {
            this.sortEngine.sort(sortByVariable.state.value as SortingOption);
            return;
          }

          if (!isEqual(newState.options, prevState.options)) {
            this.sortEngine.sort(sortByVariable.state.value as SortingOption);
            return;
          }
        })
      );
    } catch (error) {
      console.warn('MetricsSorter not found - no worries, gracefully degrading...', error);
    }
  }

  public updateGroupByQuery(groupByValue: string) {
    const matcher =
      groupByValue && groupByValue !== NULL_GROUP_BY_VALUE ? `${groupByValue}!="",$${VAR_FILTERS}` : `$${VAR_FILTERS}`;

    const query = `label_values({${matcher}}, __name__)`;

    if (query !== this.state.query) {
      this.setState({ query });
      this.refreshOptions();
    }
  }

  public applyFilters(filters: Partial<MetricFilters>, notify = true, forceUpdate = false) {
    this.filterEngine.applyFilters(filters, notify, forceUpdate);
  }

  public sort() {
    this.sortEngine.sort();
  }
}
