import { type MultiValueVariable, type MultiValueVariableState } from '@grafana/scenes';

import { EventMetricsVariableActivated } from './events/EventMetricsVariableActivated';
import { EventMetricsVariableDeactivated } from './events/EventMetricsVariableDeactivated';
import { EventMetricsVariableLoaded } from './events/EventMetricsVariableLoaded';

/**
 * Adds the publication of lifecycle events to a metrics variable:
 *
 * - `EventMetricsVariableActivated`
 * - `EventMetricsVariableDeactivated`
 * - `EventMetricsVariableLoaded`
 *
 * This is particularly useful for filtering and sorting the variable options, while keeping the
 * different pieces of code decoupled.
 *
 * The filtering and sorting logic is centralized in the `MetricsReducer` class.
 */
export function withLifecycleEvents<T extends MultiValueVariable>(variable: T): T {
  const key = variable.state.key as string;

  if (!key) {
    throw new TypeError(
      `Variable "${variable.state.name}" has no key. Please provide a key in order to publish its lifecycle events.`
    );
  }

  variable.addActivationHandler(() => {
    variable.publishEvent(new EventMetricsVariableActivated({ key }), true);

    // We make sure filtering and sorting work in a scenario where the user goes from the MetricsReducer to the MetricScene and back.
    // Indeed, sometimes, the variable already has its options and does not load new ones (issue reported in a dev env).
    if (!variable.state.loading && variable.state.options.length) {
      variable.publishEvent(new EventMetricsVariableLoaded({ key, options: variable.state.options }), true);
    }

    const sub = variable.subscribeToState((newState: MultiValueVariableState, prevState: MultiValueVariableState) => {
      if (!newState.loading && prevState.loading) {
        variable.publishEvent(new EventMetricsVariableLoaded({ key, options: newState.options }), true);
      }
    });

    return () => {
      sub.unsubscribe();
      variable.publishEvent(new EventMetricsVariableDeactivated({ key }), true);
    };
  });

  return variable;
}
