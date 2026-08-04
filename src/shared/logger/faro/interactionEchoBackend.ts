import { EchoEventType, isInteractionEvent, registerEchoBackend, type EchoEvent } from '@grafana/runtime';

import { getFaro } from './faro';

// matches INTERACTION_NAME_PREFIX in shared/tracking/interactions.ts
const PLUGIN_INTERACTION_PREFIX = 'grafana_explore_metrics_';

// faro event attributes must be strings
const toEventAttributes = (properties: Record<string, unknown> = {}): Record<string, string> => {
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null) {
      continue;
    }
    attributes[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  return attributes;
};

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
        getFaro()?.api.pushEvent(event.payload.interactionName, toEventAttributes(event.payload.properties));
      }
    },
    flush: () => {},
  });
}
