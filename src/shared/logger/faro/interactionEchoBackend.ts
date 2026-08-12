import { stringifyObjectValues } from '@grafana/faro-core';
import { EchoEventType, isInteractionEvent, registerEchoBackend, type EchoEvent } from '@grafana/runtime';

import { getFaro } from './faro';

// matches INTERACTION_NAME_PREFIX in shared/tracking/interactions.ts
const PLUGIN_INTERACTION_PREFIX = 'grafana_explore_metrics_';

let registered = false;

// mirrors this plugin's reportInteraction events into faro as events
export function registerFaroInteractionEchoBackend() {
  if (registered) {
    return;
  }
  registered = true;

  registerEchoBackend({
    options: {},
    supportedEvents: [EchoEventType.Interaction],
    addEvent: (event: EchoEvent) => {
      if (isInteractionEvent(event) && event.payload.interactionName.startsWith(PLUGIN_INTERACTION_PREFIX)) {
        // faro event attributes must be strings
        getFaro()?.api.pushEvent(event.payload.interactionName, stringifyObjectValues(event.payload.properties));
      }
    },
    flush: () => {},
  });
}
