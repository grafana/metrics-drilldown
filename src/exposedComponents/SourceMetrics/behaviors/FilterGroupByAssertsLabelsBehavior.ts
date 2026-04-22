import { SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

import { GroupByOptionsLoadedEvent, type GroupByVariable } from 'MetricScene/Breakdown/GroupByVariable';

/**
 * Behavior that filters out "asserts_*" labels from the Breakdown view.
 * Subscribes at the root level to catch bubbled events from GroupByVariable when options are loaded.
 */
export class FilterGroupByAssertsLabelsBehavior extends SceneObjectBase<SceneObjectState> {
  public constructor(params: { metric: string | undefined }) {
    super({});

    this.addActivationHandler(() => {
      // Subscribe to the event at the root level to catch bubbled events
      const subscription = this.getRoot().subscribeToEvent(GroupByOptionsLoadedEvent, (event) => {
        if (params.metric?.startsWith('asserts')) {
          // Avoid filtering asserts labels if selecting an asserts metric (not a source metric)
          return;
        }

        this.filterVariableOptions(event.payload);
      });

      return () => subscription.unsubscribe();
    });
  }

  private filterVariableOptions(variable: GroupByVariable) {
    const currentOptions = variable.state.options;

    if (currentOptions.length === 0) {
      return;
    }

    const filtered = currentOptions.filter((option) => !String(option.value).startsWith('asserts'));

    if (filtered.length !== currentOptions.length) {
      variable.setState({ options: filtered });
    }
  }
}
