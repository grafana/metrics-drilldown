import { sceneGraph, type MultiValueVariable } from '@grafana/scenes';

import { VAR_FILTERS } from 'shared';
import { EventQuickSearchChanged } from 'WingmanDataTrail/HeaderControls/QuickSearch/EventQuickSearchChanged';
import { QuickSearch } from 'WingmanDataTrail/HeaderControls/QuickSearch/QuickSearch';
import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';

import { MetricsVariable } from './MetricsVariable';
import { MetricsVariableFilterEngine, type MetricFilters } from './MetricsVariableFilterEngine';
export const VAR_FILTERED_METRICS_VARIABLE = 'filtered-metrics-wingman';

export class FilteredMetricsVariable extends MetricsVariable {
  private filterEngine: MetricsVariableFilterEngine;

  constructor() {
    super({
      name: VAR_FILTERED_METRICS_VARIABLE,
      label: 'Filtered Metrics',
    });

    this.filterEngine = new MetricsVariableFilterEngine(this as unknown as MultiValueVariable);

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
        }
      })
    );

    this._subs.add(
      quickSearch.subscribeToEvent(EventQuickSearchChanged, (event) => {
        this.filterEngine.applyFilters({ names: event.payload.searchText ? [event.payload.searchText] : [] });
      })
    );
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
}
