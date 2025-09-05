import { CustomVariable, sceneGraph } from '@grafana/scenes';

import { EventMetricsVariableLoaded } from './EventMetricsVariableLoaded';
import { MetricsVariable, VAR_METRICS_VARIABLE } from './MetricsVariable';
import { withLifecycleEvents } from './withLifecycleEvents';

export const VAR_CLIENT_FILTERED_METRICS = 'client-filtered-metrics-wingman';
// Backward compatibility alias
export const VAR_FILTERED_METRICS_VARIABLE = VAR_CLIENT_FILTERED_METRICS;

/**
 * Applies client-side sidebar filters (rules, prefixes, suffixes) to server-side search results.
 * Syncs with MetricsVariable and applies additional filtering for sidebar filter selections.
 */
export class ClientSideFilteredMetricsVariable extends CustomVariable {
  constructor() {
    super({
      key: VAR_CLIENT_FILTERED_METRICS,
      name: VAR_CLIENT_FILTERED_METRICS,
      label: 'Client-Side Filtered Metrics',
      loading: false,
      error: null,
      options: [],
      includeAll: true,
      value: '$__all',
      skipUrlSync: true,
    });

    this.addActivationHandler(this.onActivate.bind(this));

    // required for filtering and sorting
    return withLifecycleEvents<ClientSideFilteredMetricsVariable>(this);
  }

  private onActivate() {
    const metricsVariable = sceneGraph.findByKeyAndType(this, VAR_METRICS_VARIABLE, MetricsVariable);
    const { loading, error, options } = metricsVariable.state;

    this.setState({ loading, error, options });

    this._subs.add(
      metricsVariable.subscribeToState((newState) => {
        this.setState({
          loading: newState.loading,
          error: newState.error,
          options: newState.options,
        });

        // When new server data arrives, trigger reapplication of client-side filters
        if (!newState.loading && newState.options.length > 0) {
          this.publishEvent(new EventMetricsVariableLoaded({ 
            key: this.state.key!, 
            options: newState.options 
          }), true);
        }
      })
    );

  }
}

// Export alias for backward compatibility
export const FilteredMetricsVariable = ClientSideFilteredMetricsVariable;
