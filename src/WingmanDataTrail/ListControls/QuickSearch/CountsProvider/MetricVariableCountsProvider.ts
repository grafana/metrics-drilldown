import { sceneGraph, type MultiValueVariable } from '@grafana/scenes';

import { TrueTotalService } from 'services/TrueTotalService';
import { VAR_DATASOURCE } from 'shared';
import { VAR_CLIENT_FILTERED_METRICS } from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { areArraysEqual } from 'WingmanDataTrail/MetricsVariables/helpers/areArraysEqual';

import { CountsProvider } from './CountsProvider';

export class MetricVariableCountsProvider extends CountsProvider {
  private trueTotalCount = 0;

  constructor() {
    super({ key: 'MetricVariableCountsProvider' });
    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    // Use client-side filtered variable for current count (final filtered results)
    const clientFilteredVariable = sceneGraph.lookupVariable(VAR_CLIENT_FILTERED_METRICS, this) as MultiValueVariable;

    // Load true total count once
    this.loadTrueTotalCount();

    // Subscribe to datasource changes to refresh true total
    this._subs.add(
      sceneGraph.findByKey(this, VAR_DATASOURCE)?.subscribeToState((newState, prevState) => {
        if ((newState as any).value !== (prevState as any).value) {
          // Datasource changed - get new true total
          this.loadTrueTotalCount();
        }
      }) || (() => {})
    );

    // Subscribe to time range changes to refresh true total
    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState((newState, prevState) => {
        if (newState.value.from !== prevState.value.from || newState.value.to !== prevState.value.to) {
          // Time range changed - get new true total
          this.loadTrueTotalCount();
        }
      })
    );

    // Subscribe to client-side filtered variable for current count (final results after all filtering)
    this._subs.add(
      clientFilteredVariable.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.options, prevState.options)) {
          this.updateCounts(newState.options.length);
        }
      })
    );
  }

  /**
   * Load the true total count using direct API calls
   */
  private async loadTrueTotalCount() {
    try {
      this.trueTotalCount = await TrueTotalService.getTrueTotalCount(this);
      this.updateCounts();
    } catch {
      // Fallback to current count if true total fails to load
      this.trueTotalCount = 0;
    }
  }

  /**
   * Update the counts display with current count and true total
   */
  private updateCounts(currentCount?: number) {
    const clientFilteredVariable = sceneGraph.lookupVariable(VAR_CLIENT_FILTERED_METRICS, this) as MultiValueVariable;
    
    // Current: final filtered results (server-side + client-side)
    const current = currentCount ?? clientFilteredVariable.state.options.length;
    // Total: unlimited count from direct API
    const total = this.trueTotalCount || current;

    this.setState({
      counts: {
        current,
        total,
      },
    });
  }

}
