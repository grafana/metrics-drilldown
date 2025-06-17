import { sceneGraph, VizPanel, type SceneObject, type SceneObjectState } from '@grafana/scenes';
import { cloneDeep, merge } from 'lodash';

import { EventTimeseriesDataReceived } from 'Breakdown/MetricLabelsList/events/EventTimeseriesDataReceived';

/**
 * Synchronizes the Y-axis ranges across children timeseries panels by listening to data updates from publishTimeseriesData.
 * When new data arrives, it calculates the global min/max values and updates all children panels to use the same scale.
 */
export function syncYAxis() {
  return (vizPanelsParent: SceneObject<SceneObjectState>) => {
    let max = Number.NEGATIVE_INFINITY;
    let min = Number.POSITIVE_INFINITY;

    const timeRangeSub = sceneGraph.getTimeRange(vizPanelsParent).subscribeToState(() => {
      max = Number.NEGATIVE_INFINITY;
      min = Number.POSITIVE_INFINITY;
    });

    const eventSub = vizPanelsParent.subscribeToEvent(EventTimeseriesDataReceived, (event) => {
      const series = event.payload.series || [];
      let newMax = max;
      let newMin = min;

      for (const s of series) {
        const values = s.fields[1]?.values.filter(Boolean);

        if (values) {
          newMax = Math.max(newMax, ...values);
          newMin = Math.min(newMin, ...values);
        }
      }

      if (newMax !== max && newMin !== min && newMax !== newMin) {
        [max, min] = [newMax, newMin];
        updateTimeseriesAxis(vizPanelsParent, max, min);
      }
    });

    return () => {
      eventSub.unsubscribe();
      timeRangeSub.unsubscribe();
    };
  };
}

function updateTimeseriesAxis(vizPanelsParent: SceneObject, max: number, min: number) {
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
