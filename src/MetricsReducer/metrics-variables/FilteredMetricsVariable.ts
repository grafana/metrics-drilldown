import { CustomVariable, sceneGraph } from '@grafana/scenes';

import { MetricsVariable, VAR_METRICS_VARIABLE } from './MetricsVariable';
import { withLifecycleEvents } from './withLifecycleEvents';

export const VAR_FILTERED_METRICS_VARIABLE = 'filtered-metrics-wingman';

export class FilteredMetricsVariable extends CustomVariable {
  constructor() {
    super({
      key: VAR_FILTERED_METRICS_VARIABLE,
      name: VAR_FILTERED_METRICS_VARIABLE,
      label: 'Filtered Metrics',
      loading: false,
      error: null,
      options: [],
      includeAll: true,
      value: '$__all',
      skipUrlSync: true,
    });

    this.addActivationHandler(this.onActivate.bind(this));

    // required for filtering and sorting
    return withLifecycleEvents<FilteredMetricsVariable>(this);
  }

  private onActivate() {
    const metricsVariable = sceneGraph.findByKeyAndType(this, VAR_METRICS_VARIABLE, MetricsVariable);
    const { loading, error, options } = metricsVariable.state;

    this.setState({ loading, error, options });

    this._subs.add(
      metricsVariable.subscribeToState((newState, prevState) => {
        // Only copy options when loading completes (loading: true → false)
        // This prevents overwriting filtered options on other state changes
        const isLoadComplete = prevState.loading && !newState.loading;

        this.setState({
          loading: newState.loading,
          error: newState.error,
          ...(isLoadComplete && { options: newState.options }),
        });
      })
    );
  }
}
