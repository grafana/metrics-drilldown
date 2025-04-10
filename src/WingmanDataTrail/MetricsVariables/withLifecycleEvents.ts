import { type MultiValueVariable, type MultiValueVariableState } from '@grafana/scenes';
import { type Unsubscribable } from 'rxjs';

import { EventMetricsVariableActivated } from './EventMetricsVariableActivated';
import { EventMetricsVariableDeactivated } from './EventMetricsVariableDeactivated';
import { EventMetricsVariableLoaded } from './EventMetricsVariableLoaded';
import { EventMetricsVariableUpdated } from './EventMetricsVariableUpdated';
import { areArraysEqual } from './helpers/areArraysEqual';

/**
 * Adds the publication of lifecycle events to a metrics variable:
 *
 * - `EventMetricsVariableActivated`
 * - `EventMetricsVariableDeactivated`
 * - `EventMetricsVariableLoaded`
 * - `EventMetricsVariableUpdated`
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
        variable.publishEvent(new EventMetricsVariableLoaded({ key, options: newState.options }), true);

        // we subscribe only after loading in order to prevent EventMetricsVariableUpdated to be published
        // indeed, EventMetricsVariableLoaded might trigger an initial filtering and sorting (see MetricsReducer),
        // which would lead to the publication of an unneccessary EventMetricsVariableUpdated
        let updateSub: Unsubscribable | undefined;
        if (updateSub) {
          updateSub.unsubscribe();
        }

        updateSub = variable.subscribeToState((newState, prevState) => {
          if (!areArraysEqual(newState.options, prevState.options)) {
            variable.publishEvent(new EventMetricsVariableUpdated({ key }), true);
          }
        });
      }
    });

    return () => {
      variable.publishEvent(new EventMetricsVariableDeactivated({ key }), true);
    };
  });

  return variable;
}
