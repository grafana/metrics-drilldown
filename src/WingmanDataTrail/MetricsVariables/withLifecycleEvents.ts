import { type MultiValueVariable, type MultiValueVariableState } from '@grafana/scenes';

import { EventMetricsVariableActivated } from './EventMetricsVariableActivated';
import { EventMetricsVariableDeactivated } from './EventMetricsVariableDeactivated';
import { EventMetricsVariableUpdated } from './EventMetricsVariableUpdated';

/**
 * Adds the publication of lifecycle events to a metrics variable:
 *
 * - `EventMetricsVariableActivated`
 * - `EventMetricsVariableUpdated`
 * - `EventMetricsVariableDeactivated`
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

    variable.subscribeToState((newState: MultiValueVariableState, prevState: MultiValueVariableState) => {
      if (!newState.loading && prevState.loading) {
        variable.publishEvent(new EventMetricsVariableUpdated({ key, options: newState.options }), true);
      }
    });

    return () => {
      variable.publishEvent(new EventMetricsVariableDeactivated({ key }), true);
    };
  });

  return variable;
}
