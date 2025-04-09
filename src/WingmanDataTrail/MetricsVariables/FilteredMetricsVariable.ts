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

import { EventMetricsVariableActivated } from './EventMetricsVariableActivated';
import { EventMetricsVariableDeactivated } from './EventMetricsVariableDeactivated';
import { EventMetricsVariableUpdated } from './EventMetricsVariableUpdated';
import { MetricsVariable } from './MetricsVariable';
import { MetricsVariableSortEngine } from './MetricsVariableSortEngine';

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
  }

  protected onActivate() {
    this.publishEvent(new EventMetricsVariableActivated({ key: this.state.key as string }), true);

    this.subscribeToState((newState, prevState) => {
      if (!newState.loading && prevState.loading) {
        this.publishEvent(
          new EventMetricsVariableUpdated({ key: this.state.key as string, options: newState.options }),
          true
        );
      }
    });

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

    return () => {
      this.publishEvent(new EventMetricsVariableDeactivated({ key: this.state.key as string }), true);
    };
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
