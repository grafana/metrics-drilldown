import { sceneGraph, type CustomVariable, type MultiValueVariable } from '@grafana/scenes';
import { isEqual } from 'lodash';

import { VAR_FILTERS } from 'shared';
import { EventSortByChanged } from 'WingmanDataTrail/HeaderControls/MetricsSorter/EventSortByChanged';
import {
  MetricsSorter,
  VAR_WINGMAN_SORT_BY,
  type SortingOption,
} from 'WingmanDataTrail/HeaderControls/MetricsSorter/MetricsSorter';
import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';

import { MetricsVariable } from './MetricsVariable';
import { MetricsVariableSortEngine } from './MetricsVariableSortEngine';
import { withLifecycleEvents } from './withLifecycleEvents';

export const VAR_FILTERED_METRICS_VARIABLE = 'filtered-metrics-wingman';

export class FilteredMetricsVariable extends MetricsVariable {
  private sortEngine: MetricsVariableSortEngine;

  constructor() {
    super({
      key: VAR_FILTERED_METRICS_VARIABLE,
      name: VAR_FILTERED_METRICS_VARIABLE,
      label: 'Filtered Metrics',
    });

    this.sortEngine = new MetricsVariableSortEngine(this as unknown as MultiValueVariable);

    this.addActivationHandler(this.onActivate.bind(this));

    // required for filtering and sorting
    return withLifecycleEvents<FilteredMetricsVariable>(this);
  }

  protected onActivate() {
    // wrapped in a try/catch to support the different variants / prevents runtime errors in WingMan's onboarding screen
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

  public sort() {
    this.sortEngine.sort();
  }
}
