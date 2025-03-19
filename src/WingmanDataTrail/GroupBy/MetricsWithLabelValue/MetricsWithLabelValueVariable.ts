import { VariableHide, VariableRefresh } from '@grafana/data';
import { QueryVariable, sceneGraph, type MultiValueVariable } from '@grafana/scenes';

import { EventFiltersChanged } from 'WingmanDataTrail/HeaderControls/QuickSearch/EventFiltersChanged';
import { EventQuickSearchChanged } from 'WingmanDataTrail/HeaderControls/QuickSearch/EventQuickSearchChanged';
import { QuickSearch } from 'WingmanDataTrail/HeaderControls/QuickSearch/QuickSearch';
import { MetricsVariableFilterEngine } from 'WingmanDataTrail/MetricsVariables/MetricsVariableFilterEngine';
import { SideBar } from 'WingmanDataTrail/SideBar/SideBar';

import { MetricsWithLabelValueDataSource } from './MetricsWithLabelValueDataSource';

export const VAR_METRIC_WITH_LABEL_VALUE = 'metrics-with-label-value';

export class MetricsWithLabelValueVariable extends QueryVariable {
  private filterEngine: MetricsVariableFilterEngine;

  constructor({ labelName, labelValue }: { labelName: string; labelValue: string }) {
    super({
      name: VAR_METRIC_WITH_LABEL_VALUE,
      datasource: { uid: MetricsWithLabelValueDataSource.uid },
      query: `{${labelName}="${labelValue}"}`,
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

    this.filterEngine = new MetricsVariableFilterEngine(this as unknown as MultiValueVariable);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  protected onActivate() {
    const quickSearch = sceneGraph.findByKeyAndType(this, 'quick-search', QuickSearch);
    const sideBar = sceneGraph.findByKeyAndType(this, 'sidebar', SideBar);

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.loading === false && prevState.loading === true) {
          this.filterEngine.setInitOptions(newState.options);

          // TODO: use events publishing and subscribe in the main Wingman Scene?
          this.filterEngine.applyFilters(
            {
              names: quickSearch.state.value ? [quickSearch.state.value] : [],
              prefixes: sideBar.state.selectedMetricPrefixes,
            },
            false
          );
        }
      })
    );

    this._subs.add(
      quickSearch.subscribeToEvent(EventQuickSearchChanged, (event) => {
        this.filterEngine.applyFilters({ names: event.payload.searchText ? [event.payload.searchText] : [] });
      })
    );

    this._subs.add(
      sideBar.subscribeToEvent(EventFiltersChanged, (event) => {
        const { filters, type } = event.payload;
        this.filterEngine.applyFilters({ [type]: filters });
      })
    );
  }
}
