import { sceneGraph, type MultiValueVariable } from '@grafana/scenes';

import { VAR_FILTERED_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { areArraysEqual } from 'WingmanDataTrail/MetricsVariables/helpers/areArraysEqual';
import { VAR_METRICS_VARIABLE, VAR_ORIGINAL_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';

import { CountsProvider } from './CountsProvider';

export class MetricVariableCountsProvider extends CountsProvider {
  private originalTotalCount: number = 0;

  constructor() {
    super({ key: 'MetricVariableCountsProvider' });
    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    // Try to use the original metrics variable for total count (preserves original)
    const originalMetricsVariable = sceneGraph.lookupVariable(VAR_ORIGINAL_METRICS_VARIABLE, this) as MultiValueVariable;
    // Use the searchable metrics variable for current count (changes with server-side search)
    const searchableMetricsVariable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MultiValueVariable;
    // Use the filtered variable for client-side filtering compatibility
    const filteredVariable = sceneGraph.lookupVariable(VAR_FILTERED_METRICS_VARIABLE, this) as MultiValueVariable;

    // Fall back to the searchable variable if original doesn't exist (backward compatibility)
    const totalCountVariable = originalMetricsVariable || searchableMetricsVariable;
    
    this.setInitCounts(totalCountVariable, filteredVariable);

    // Subscribe to the variable that provides the total count
    this._subs.add(
      totalCountVariable.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.options, prevState.options)) {
          // Track the maximum count we've ever seen as the true total
          // This handles the case where user starts with filters applied
          if (newState.options.length > this.originalTotalCount) {
            this.originalTotalCount = newState.options.length;
          }
          
          // Update counts - fix the logic
          // The searchable variable now contains the server-filtered results (current)
          // The original total should be the maximum we've ever seen
          const currentCount = searchableMetricsVariable.state.options.length; // Server-filtered results
          const totalCount = this.originalTotalCount; // Maximum count ever seen
          
          this.setState({
            counts: {
              current: currentCount,
              total: totalCount,
            },
          });
        }
      })
    );

    // Subscribe to searchable metrics variable for current count (updates with server-side search)
    this._subs.add(
      searchableMetricsVariable.subscribeToState((newState, prevState) => {
        if (!newState.loading && !prevState.loading && !areArraysEqual(newState.options, prevState.options)) {
          // Use preserved original total, current from searchable variable
          const totalCount = this.originalTotalCount || totalCountVariable.state.options.length;
          this.setState({
            counts: {
              current: newState.options.length, // Server-side filtered count
              total: totalCount,                // Original total preserved
            },
          });
        }
      })
    );

    // Keep filtered variable subscription for compatibility with client-side filtering
    this._subs.add(
      filteredVariable.subscribeToState((newState, prevState) => {
        if (!newState.loading && !prevState.loading && !areArraysEqual(newState.options, prevState.options)) {
          const totalCount = this.originalTotalCount || totalCountVariable.state.options.length;
          this.setState({
            counts: {
              current: newState.options.length,
              total: totalCount,
            },
          });
        }
      })
    );
  }

  private setInitCounts(nonFilteredVariable: MultiValueVariable, filteredVariable: MultiValueVariable) {
    const initCounts = { current: 0, total: 0 };

    // We make sure the count of metrics is not 0 in a scenario where the user goes from the MetricsReducer to the MetricScene and back.
    // Indeed, sometimes, the variables already have their options and do not load new ones.
    if (!nonFilteredVariable.state.loading && nonFilteredVariable.state.options.length) {
      initCounts.total = nonFilteredVariable.state.options.length;
    }

    if (!filteredVariable.state.loading && filteredVariable.state.options.length) {
      initCounts.current = filteredVariable.state.options.length;
    }

    this.setState({ counts: initCounts });
  }
}
