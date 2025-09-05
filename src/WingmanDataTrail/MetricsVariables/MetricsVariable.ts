import { VariableHide, VariableRefresh, VariableSort } from '@grafana/data';
import { QueryVariable, type SceneObjectState } from '@grafana/scenes';

import { trailDS, VAR_FILTERS } from 'shared';
import { SearchableMetricsDataSource } from 'WingmanDataTrail/ListControls/QuickSearch/SearchableMetricsDataSource';

export const VAR_METRICS_VARIABLE = 'metrics-wingman';

export type MetricOptions = Array<{ label: string; value: string }>;

interface MetricsVariableState extends SceneObjectState {
  key: string;
  name?: string;
  label?: string;
}

export class MetricsVariable extends QueryVariable {
  private isSearching: boolean = false;
  private currentSearchText: string = '';

  constructor(state?: MetricsVariableState) {
    super({
      key: VAR_METRICS_VARIABLE,
      name: VAR_METRICS_VARIABLE,
      label: 'Metrics',
      ...state,
      datasource: trailDS, // Start with normal datasource
      query: `label_values({$${VAR_FILTERS}}, __name__)`, // Start with normal query
      includeAll: true,
      value: '$__all',
      skipUrlSync: true,
      refresh: VariableRefresh.onTimeRangeChanged,
      sort: VariableSort.alphabeticalAsc,
      hide: VariableHide.hideVariable,
    });

  }

  /**
   * Update the variable's datasource and query based on search state
   * This is the proper Scenes way - switch datasource based on behavior needed
   */
  public updateSearchState(searchText: string) {
    const hasSearch = searchText && searchText.trim();
    const searchChanged = this.currentSearchText !== searchText;
    
    this.currentSearchText = searchText;

    if (hasSearch && (!this.isSearching || searchChanged)) {
      // Switch to search datasource for server-side filtering
      this.isSearching = true;
      this.setState({
        datasource: { uid: SearchableMetricsDataSource.uid },
        query: searchText.trim(), // Pass search text as query
      });
      this.refreshOptions();
      
    } else if (!hasSearch && this.isSearching) {
      // Switch back to normal datasource for all metrics
      this.isSearching = false;
      this.setState({
        datasource: trailDS,
        query: `label_values({$${VAR_FILTERS}}, __name__)`,
      });
      this.refreshOptions();
    }
  }
}
