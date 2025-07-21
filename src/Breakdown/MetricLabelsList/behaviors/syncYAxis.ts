import { sceneGraph, VizPanel, type SceneObject, type SceneObjectState } from '@grafana/scenes';
import { cloneDeep, merge } from 'lodash';

import { EventTimeseriesDataReceived } from 'Breakdown/MetricLabelsList/events/EventTimeseriesDataReceived';

import { EventResetSyncYAxis } from '../events/EventResetSyncYAxis';

/**
 * Synchronizes the Y-axis ranges across children timeseries panels by listening to data updates from publishTimeseriesData.
 * When new data arrives, it calculates the global min/max values and updates all children panels to use the same scale.
 */
export function syncYAxis() {
  return (vizPanelsParent: SceneObject<SceneObjectState>) => {
    let max = Number.NEGATIVE_INFINITY;
    let min = Number.POSITIVE_INFINITY;

    // reset after timerange changes
    const timeRangeSub = sceneGraph.getTimeRange(vizPanelsParent).subscribeToState(() => {
      max = Number.NEGATIVE_INFINITY;
      min = Number.POSITIVE_INFINITY;
    });

    // reset after receiving the EventResetSyncYAxis event (e.g. see SceneByFrameRepeater)
    const resetSub = vizPanelsParent.subscribeToEvent(EventResetSyncYAxis, () => {
      max = Number.NEGATIVE_INFINITY;
      min = Number.POSITIVE_INFINITY;
    });

    // new data coming...
    const dataReceivedSub = vizPanelsParent.subscribeToEvent(EventTimeseriesDataReceived, (event) => {
      const { series } = event.payload;
      let newMax = max;
      let newMin = min;

      for (const s of series || []) {
        const values = s.fields[1]?.values.filter(Boolean);

        if (values) {
          newMax = Math.max(newMax, ...values);
          newMin = Math.min(newMin, ...values);
        }
      }

      if (
        newMax !== newMin &&
        newMax !== Number.NEGATIVE_INFINITY &&
        newMin !== Number.POSITIVE_INFINITY &&
        (newMax !== max || newMin !== min)
      ) {
        [max, min] = [newMax, newMin];
        updateAllTimeseriesAxis(vizPanelsParent, newMax, newMin);
      }
    });

    return () => {
      dataReceivedSub.unsubscribe();
      resetSub.unsubscribe();
      timeRangeSub.unsubscribe();
    };
  };
}

function updateAllTimeseriesAxis(vizPanelsParent: SceneObject, max: number, min: number) {
  // findAllObjects searches down the full scene graph
  const timeseries = sceneGraph.findAllObjects(
    vizPanelsParent,
    (o) => o instanceof VizPanel && o.state.pluginId === 'timeseries'
  ) as VizPanel[];

  for (const t of timeseries) {
    t.clearFieldConfigCache(); // required for the fieldConfig update below

    t.setState({
      fieldConfig: merge(cloneDeep(t.state.fieldConfig), { defaults: { min, max } }),
    });
  }
}
