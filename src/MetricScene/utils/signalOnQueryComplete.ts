import { sceneGraph, type SceneObject } from '@grafana/scenes';

import { EventActionViewDataLoadComplete } from '../EventActionViewDataLoadComplete';
import { type ActionViewType } from '../MetricActionBar';

/**
 * Monitors a scene's queries and publishes a completion event when all queries finish.
 *
 * This waits for the query lifecycle: not-running → running → complete
 * and signals only when the transition from running to complete happens.
 *
 * Important: This assumes queries WILL run. Tabs without queries should
 * signal completion explicitly rather than relying on this utility.
 *
 * @param scene - The scene with a SceneQueryController behavior
 * @param actionView - Which action view this scene represents
 */
export function signalOnQueryComplete(
  scene: SceneObject & { publishEvent: (event: any, bubble: boolean) => void },
  actionView: ActionViewType
): void {
  const queryController = sceneGraph.getQueryController(scene);

  if (!queryController) {
    // No query controller means this tab doesn't use queries
    // Signal immediately so the tab doesn't block other background tasks
    scene.publishEvent(new EventActionViewDataLoadComplete({ currentActionView: actionView }), true);
    return;
  }

  // Subscribe to state changes and wait for query completion
  // We only signal when we see isRunning: true → false transition
  const subscription = queryController.subscribeToState((state, prevState) => {
    if (prevState.isRunning && !state.isRunning) {
      subscription.unsubscribe();
      scene.publishEvent(new EventActionViewDataLoadComplete({ currentActionView: actionView }), true);
    }
  });
}
