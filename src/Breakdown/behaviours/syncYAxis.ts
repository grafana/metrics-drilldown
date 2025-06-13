import { sceneGraph, VizPanel, type SceneObject, type SceneObjectState } from '@grafana/scenes';
import { cloneDeep, merge } from 'lodash';

import { EventTimeseriesDataReceived } from 'Breakdown/events/EventTimeseriesDataReceived';

export function syncYAxis() {
  return (vizPanel: SceneObject<SceneObjectState>) => {
    let max = Number.NEGATIVE_INFINITY;
    let min = Number.POSITIVE_INFINITY;

    const timeRangeSub = sceneGraph.getTimeRange(vizPanel).subscribeToState(() => {
      max = Number.NEGATIVE_INFINITY;
      min = Number.POSITIVE_INFINITY;
    });

    const eventSub = vizPanel.subscribeToEvent(EventTimeseriesDataReceived, (event) => {
      const series = event.payload.series || [];

      for (const s of series) {
        const values = s.fields[1]?.values.filter(Boolean);

        if (values) {
          max = Math.max(max, ...values);
          min = Math.min(min, ...values);
        }
      }

      if (max !== Number.NEGATIVE_INFINITY && min !== Number.POSITIVE_INFINITY) {
        updateTimeseriesAxis(vizPanel, max, min);
      }
    });

    return () => {
      eventSub.unsubscribe();
      timeRangeSub.unsubscribe();
    };
  };
}

function updateTimeseriesAxis(vizPanel: SceneObject, max: number, min: number) {
  // findAllObjects searches down the full scene graph
  const timeseries = sceneGraph.findAllObjects(
    vizPanel,
    (o) => o instanceof VizPanel && o.state.pluginId === 'timeseries'
  ) as VizPanel[];

  for (const t of timeseries) {
    t.clearFieldConfigCache(); // required for the fieldConfig update below

    t.setState({
      fieldConfig: merge(cloneDeep(t.state.fieldConfig), { defaults: { min, max } }),
    });
  }
}
