import { VariableHide, VariableRefresh, VariableSort } from '@grafana/data';
import { QueryVariable, sceneGraph, type AdHocFiltersVariable, type SceneObjectState } from '@grafana/scenes';

import { VAR_FILTERS } from 'shared';
import { QuickSearch } from 'WingmanDataTrail/ListControls/QuickSearch/QuickSearch';
import { SearchableMetricsDataSource } from 'WingmanDataTrail/ListControls/QuickSearch/SearchableMetricsDataSource';

export const VAR_METRICS_VARIABLE = 'metrics-wingman';

export type MetricOptions = Array<{ label: string; value: string }>;

interface MetricsVariableState extends SceneObjectState {
  key: string;
  name?: string;
  label?: string;
}

export class MetricsVariable extends QueryVariable {
  private currentSearchText = '';

  constructor(state?: MetricsVariableState) {
    super({
      key: VAR_METRICS_VARIABLE,
      name: VAR_METRICS_VARIABLE,
      label: 'Metrics',
      ...state,
      datasource: { uid: SearchableMetricsDataSource.uid }, // Server-side search across all metrics
      query: 'all-metrics', // Initial query for all available metrics
      includeAll: true,
      value: '$__all',
      skipUrlSync: true,
      refresh: VariableRefresh.onTimeRangeChanged,
      sort: VariableSort.alphabeticalAsc,
      hide: VariableHide.hideVariable,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    // Subscribe to adhoc filter changes to refresh when filters are added/removed
    const filtersVariable = sceneGraph.findByKey(this, VAR_FILTERS) as AdHocFiltersVariable;
    if (filtersVariable) {
      this._subs.add(
        filtersVariable.subscribeToState((newState, prevState) => {
          if (newState.filters !== prevState.filters) {
            this.refreshWithCurrentSearch();
          }
        })
      );
    }

    // Check for existing search term when page loads with search in URL
    this.checkForExistingSearch();
  }

  /**
   * Refresh the variable with the current search text
   * Used when adhoc filters change
   */
  private refreshWithCurrentSearch() {
    // Force refresh with current search text to include updated adhoc filters
    const currentQuery = this.currentSearchText && this.currentSearchText.trim() 
      ? this.currentSearchText.trim() 
      : 'all-metrics';
    
    this.setState({ query: currentQuery });
    this.refreshOptions();
  }

  /**
   * Check if there's already a search term active and switch datasource accordingly
   * This handles page loads with search terms in the URL
   */
  private checkForExistingSearch() {
    // Delay check to ensure all components are activated before reading search state
    setTimeout(() => {
      const quickSearch = sceneGraph.findByKeyAndType(this, 'quick-search', QuickSearch);
      const existingSearchText = quickSearch?.state.value || '';
      
      if (existingSearchText) {
        this.updateSearchState(existingSearchText);
      }
    }, 100);
  }

  /**
   * Update search query for server-side filtering.
   * Enables searching across all available metrics, not just first 100.
   */
  public updateSearchState(searchText: string) {
    const searchChanged = this.currentSearchText !== searchText;
    
    if (searchChanged) {
      this.currentSearchText = searchText;
      
      // Update query: search text or 'all-metrics' for no search
      const newQuery = searchText && searchText.trim() ? searchText.trim() : 'all-metrics';
      
      this.setState({ query: newQuery });
      this.refreshOptions();
    }
  }
}
