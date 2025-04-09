import { VariableHide, VariableRefresh } from '@grafana/data';
import { QueryVariable, sceneGraph, type CustomVariable, type MultiValueVariable } from '@grafana/scenes';
import { isEqual } from 'lodash';

import { VAR_FILTERS } from 'shared';
import { EventSortByChanged } from 'WingmanDataTrail/HeaderControls/MetricsSorter/EventSortByChanged';
import {
  MetricsSorter,
  VAR_WINGMAN_SORT_BY,
  type SortingOption,
} from 'WingmanDataTrail/HeaderControls/MetricsSorter/MetricsSorter';
import { MetricsVariableSortEngine } from 'WingmanDataTrail/MetricsVariables/MetricsVariableSortEngine';
import { withLifecycleEvents } from 'WingmanDataTrail/MetricsVariables/withLifecycleEvents';

import { MetricsWithLabelValueDataSource } from './MetricsWithLabelValueDataSource';

export const VAR_METRIC_WITH_LABEL_VALUE = 'metrics-with-label-value';

export class MetricsWithLabelValueVariable extends QueryVariable {
  private sortEngine: MetricsVariableSortEngine;

  constructor({
    labelName,
    labelValue,
    removeRules,
  }: {
    labelName: string;
    labelValue: string;
    removeRules?: boolean;
  }) {
    super({
      key: `${VAR_METRIC_WITH_LABEL_VALUE}-${labelName}-${labelValue}`,
      name: VAR_METRIC_WITH_LABEL_VALUE,
      datasource: { uid: MetricsWithLabelValueDataSource.uid },
      query: MetricsWithLabelValueVariable.buildQuery(labelName, labelValue, removeRules),
      isMulti: false,
      allowCustomValue: false,
      refresh: VariableRefresh.onTimeRangeChanged,
      hide: VariableHide.hideVariable,
      skipUrlSync: true,
      // BOTH "value" and "includeAll" below ensure the repetition in SceneByVariableRepeater
      // // (if not set, it'll render only the 1st variable option)
      value: '$__all',
      includeAll: true,
    });

    this.sortEngine = new MetricsVariableSortEngine(this as unknown as MultiValueVariable);

    this.addActivationHandler(this.onActivate.bind(this, labelName, labelValue, removeRules));

    // required for filtering and sorting
    return withLifecycleEvents<MetricsWithLabelValueVariable>(this);
  }

  private static buildQuery(labelName: string, labelValue: string, removeRules?: boolean) {
    return removeRules ? `removeRules{${labelName}="${labelValue}"}` : `{${labelName}="${labelValue}"}`;
  }

  protected onActivate(labelName: string, labelValue: string, removeRules?: boolean) {
    const adHocFiltersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (adHocFiltersVariable?.state.hide !== VariableHide.hideVariable) {
      this.setState({
        query: MetricsWithLabelValueVariable.buildQuery(labelName, labelValue, removeRules),
      });
    }

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
}
