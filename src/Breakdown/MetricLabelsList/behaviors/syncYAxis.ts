import { sceneGraph, VizPanel, type SceneObject, type SceneObjectState } from '@grafana/scenes';
import { cloneDeep, merge } from 'lodash';

import { EventTimeseriesDataReceived } from 'Breakdown/MetricLabelsList/events/EventTimeseriesDataReceived';
import { logger } from 'tracking/logger/logger';

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
      const { series, forceYAxisUpdate, sourcePanelKey } = event.payload;
      let newMax = max;
      let newMin = min;

      for (const s of series || []) {
        const values = s.fields[1]?.values.filter(Boolean);

        if (values) {
          newMax = Math.max(newMax, ...values);
          newMin = Math.min(newMin, ...values);
        }
      }

      if (forceYAxisUpdate) {
        if (newMax > max || newMin < min) {
          max = Math.max(max, newMax);
          min = Math.min(min, newMin);
          updateAllTimeseriesAxis(vizPanelsParent, max, min);
          return;
        }

        const sourcePanel = sceneGraph.findByKeyAndType(vizPanelsParent, sourcePanelKey as string, VizPanel);
        if (!sourcePanel) {
          logger.warn(`Cannot find source panel for key="${sourcePanelKey}"! Will not sync y-axis.`);
          return;
        }

        updateSingleTimeseriesAxis(sourcePanel, max, min);
        return;
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
      eventSub.unsubscribe();
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
    updateSingleTimeseriesAxis(t, max, min);
  }
}

function updateSingleTimeseriesAxis(vizPanel: VizPanel, max: number, min: number) {
  vizPanel.clearFieldConfigCache(); // required for the fieldConfig update below

  vizPanel.setState({
    fieldConfig: merge(cloneDeep(vizPanel.state.fieldConfig), { defaults: { min, max } }),
  });
}
