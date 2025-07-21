import { type DataFrame } from '@grafana/data';
import { sceneGraph, VizPanel, type SceneObject, type SceneObjectState } from '@grafana/scenes';
import { cloneDeep, merge } from 'lodash';

import { EventTimeseriesDataReceived } from 'Breakdown/MetricLabelsList/events/EventTimeseriesDataReceived';

import { EventForceSyncYAxis } from '../events/EventForceSyncYAxis';
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

    // reset after receiving the EventResetSyncYAxis event (see SceneByFrameRepeater when filtering/sorting)
    const resetSub = vizPanelsParent.subscribeToEvent(EventResetSyncYAxis, () => {
      max = Number.NEGATIVE_INFINITY;
      min = Number.POSITIVE_INFINITY;
    });

    // force new panels update after receiving the EventForceSyncYAxis event (see SceneByFrameRepeater when paginating)
    const forceSub = vizPanelsParent.subscribeToEvent(EventForceSyncYAxis, () => {
      let [newMax, newMin] = [max, min];

      const nonSyncedPanels = findAllTimeseriesPanels(vizPanelsParent).filter((t) => {
        const { fieldConfig, $data } = t.state;

        if ('min' in fieldConfig.defaults && 'max' in fieldConfig.defaults) {
          return false; // we assume it's already synced (see updateAllTimeseriesAxis below)
        }

        [newMax, newMin] = findNewMaxMin($data?.state.data?.series || [], newMax, newMin);
        return true;
      });

      if (newMax === max && newMin === min) {
        updateAllTimeseriesAxis(vizPanelsParent, max, min, nonSyncedPanels);
      } else {
        [max, min] = [newMax, newMin];
        updateAllTimeseriesAxis(vizPanelsParent, newMax, newMin);
      }
    });

    // new data coming...
    const dataReceivedSub = vizPanelsParent.subscribeToEvent(EventTimeseriesDataReceived, (event) => {
      const [newMax, newMin] = findNewMaxMin(event.payload.series || [], max, min);

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
      forceSub.unsubscribe();
      resetSub.unsubscribe();
      timeRangeSub.unsubscribe();
    };
  };
}

function findNewMaxMin(series: DataFrame[], max: number, min: number) {
  let [newMax, newMin] = [max, min];

  for (const s of series || []) {
    const values = s.fields[1]?.values.filter(Boolean);

    if (values) {
      newMax = Math.max(newMax, ...values);
      newMin = Math.min(newMin, ...values);
    }
  }

  return [newMax, newMin];
}

function findAllTimeseriesPanels(vizPanelsParent: SceneObject) {
  // findAllObjects searches down the full scene graph
  return sceneGraph.findAllObjects(
    vizPanelsParent,
    (o) => o instanceof VizPanel && o.state.pluginId === 'timeseries'
  ) as VizPanel[];
}

function updateAllTimeseriesAxis(vizPanelsParent: SceneObject, max: number, min: number, panels?: VizPanel[]) {
  for (const t of panels || findAllTimeseriesPanels(vizPanelsParent)) {
    t.clearFieldConfigCache(); // required for the fieldConfig update below

    t.setState({
      fieldConfig: merge(cloneDeep(t.state.fieldConfig), { defaults: { min, max } }),
    });
  }
}
