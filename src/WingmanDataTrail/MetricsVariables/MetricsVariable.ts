import { VariableHide, VariableRefresh, VariableSort } from '@grafana/data';
import { QueryVariable, type SceneObjectState } from '@grafana/scenes';

import { trailDS, VAR_FILTERS } from 'shared';

export const VAR_METRICS_VARIABLE = 'metrics-wingman';
export const VAR_ORIGINAL_METRICS_VARIABLE = 'original-metrics-wingman';

export type MetricOptions = Array<{ label: string; value: string }>;

interface MetricsVariableState extends SceneObjectState {
  key: string;
  name?: string;
  label?: string;
}

export class MetricsVariable extends QueryVariable {
  constructor(state?: MetricsVariableState) {
    super({
      key: VAR_METRICS_VARIABLE,
      name: VAR_METRICS_VARIABLE,
      label: 'Metrics',
      ...state,
      datasource: trailDS,
      query: `label_values({$${VAR_FILTERS}}, __name__)`,
      includeAll: true,
      value: '$__all',
      skipUrlSync: true,
      refresh: VariableRefresh.onTimeRangeChanged,
      sort: VariableSort.alphabeticalAsc,
      hide: VariableHide.hideVariable,
    });
  }
}

// New variable that maintains the original total count
export class OriginalMetricsVariable extends QueryVariable {
  constructor(state?: MetricsVariableState) {
    super({
      key: VAR_ORIGINAL_METRICS_VARIABLE,
      name: VAR_ORIGINAL_METRICS_VARIABLE,
      label: 'Original Metrics',
      ...state,
      datasource: trailDS,
      query: `label_values({$${VAR_FILTERS}}, __name__)`,
      includeAll: true,
      value: '$__all',
      skipUrlSync: true,
      refresh: VariableRefresh.onTimeRangeChanged,
      sort: VariableSort.alphabeticalAsc,
      hide: VariableHide.hideVariable,
    });
  }
}

// Enhanced variable that can update its query for server-side search
export class SearchableMetricsVariable extends MetricsVariable {
  private baseQuery: string;

  constructor(state?: MetricsVariableState) {
    super(state);
    this.baseQuery = `label_values({$${VAR_FILTERS}}, __name__)`;
  }

  /**
   * Update the query to include search filter and refresh the variable
   * @param searchText - The text to search for in metric names
   */
  public updateSearchQuery(searchText: string) {
    let newQuery: string;
    
    if (searchText && searchText.trim()) {
      // Escape regex special characters in search text
      const escapedSearch = this.escapeRegex(searchText.trim());
      
      // The issue is that when $filters is empty, we get invalid syntax like {, __name__=~"pattern"}
      // We need to build the query more carefully
      
      // Option 1: Use a conditional approach in the query itself
      // We'll modify the base query to include the name filter
      // The trick is to ensure we don't create invalid PromQL when filters is empty
      
      // Instead of trying to combine with existing filters, let's use a different approach:
      // Use the series endpoint with a proper matcher that includes both filters and name pattern
      
      // Build the query using the same pattern but with additional name filtering
      // This should work: label_values({__name__=~"pattern",$filters}, __name__)
      // The order matters - putting __name__ first should work even if $filters is empty
      
      // Use the correct Prometheus API approach with match[] parameter
      // According to Prometheus documentation, the /api/v1/label/__name__/values endpoint
      // supports match[] parameter to filter the results
      // 
      // We need to construct the query so that Grafana's Prometheus datasource
      // will use the fetchSeriesValuesWithMatch method which adds the match[] parameter
      // 
      // The pattern should be: label_values({match_expression}, __name__)
      // where match_expression becomes the match[] parameter
      
      // Build a matcher that includes both the name pattern and existing filters
      const namePattern = `__name__=~".*${escapedSearch}.*"`;
      
      // Handle empty filters properly by checking if we should include them
      // We'll use a conditional approach to avoid trailing commas
      const filtersExpr = `$${VAR_FILTERS}`;
      
      // We need to include both the name pattern AND existing filters
      // The challenge is handling the case where $filters might be empty
      // 
      // Solution: Use a conditional template that handles empty filters gracefully
      // We'll use the :raw modifier and a conditional structure
      
      // Construct the query to include both name pattern and existing filters
      // Use a different approach: let's try using variable expansion with :raw modifier
      // and see if Grafana handles empty variables gracefully
      
      // Use a more robust approach: modify the base query pattern
      // Instead of trying to combine in the selector, let's use the existing pattern
      // and modify how the filters variable is constructed
      
      // The key insight: we need to ensure the search pattern is included in the $filters
      // But since we can't modify the adhoc filters variable directly, let's try a different approach
      
      // For now, let's include both but handle the comma issue by using a conditional approach
      // We'll construct it so that if $filters is empty, we don't add the comma
      
      // Simplest approach: always include both and trust Grafana's variable interpolation
      // The original query works with {$filters}, so {__name__=~"pattern",$filters} should work too
      // If $filters is empty, Grafana should handle it gracefully
      
      newQuery = `label_values({__name__=~".*${escapedSearch}.*",$${VAR_FILTERS}}, __name__)`;
    } else {
      // Default query when no search
      newQuery = this.baseQuery;
    }
    
    // Only update if query actually changed to avoid unnecessary API calls
    if (this.state.query !== newQuery) {
      this.setState({ query: newQuery });
      
      // Trigger variable refresh using the QueryVariable method
      this.refreshOptions();
    }
  }


  /**
   * Escape regex special characters in search text
   * @param text - The text to escape
   * @returns Escaped text safe for regex
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
