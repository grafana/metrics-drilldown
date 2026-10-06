import { LoadingState } from '@grafana/data';
import { sceneGraph, type SceneDataProvider, type VizPanel } from '@grafana/scenes';

import { EventTimeseriesDataReceived } from '../events/EventTimeseriesDataReceived';

/**
 * Publishes timeseries data events when new data arrives from the VizPanel data provider.
 * These events are used by the syncYAxis behaviour to coordinate updates across multiple panels.
 *
 * Reads from sceneGraph.getData(vizPanel) directly, not from its upstream $data, so a group-by
 * panel's SceneDataTransformer output (after sliceSeries caps it to MAX_SERIES_TO_RENDER_WHEN_GROUPED_BY)
 * is what feeds the sync calculation, matching what the panel actually draws.
 */
export function publishTimeseriesData() {
  return (vizPanel: VizPanel) => {
    if (vizPanel.state.pluginId !== 'timeseries') {
      return;
    }

    const $data = sceneGraph.getData(vizPanel);
    const { data } = $data.state;

    if (data?.state === LoadingState.Done && data.series?.length) {
      vizPanel.publishEvent(
        new EventTimeseriesDataReceived({
          panelKey: vizPanel.state.key as string,
          series: data.series,
        }),
        true
      );
    }

    const sub = ($data as SceneDataProvider).subscribeToState((newState, prevState) => {
      if (
        newState.data?.state === LoadingState.Done &&
        newState.data.series?.length &&
        newState.data.series !== prevState.data?.series
      ) {
        const dataFrameType = newState.data.series[0].meta?.type;
        if (dataFrameType && !dataFrameType.startsWith('timeseries')) {
          return;
        }

        vizPanel.publishEvent(
          new EventTimeseriesDataReceived({
            panelKey: vizPanel.state.key as string,
            series: newState.data.series,
          }),
          true
        );
      }
    });

    return () => {
      sub.unsubscribe();
    };
  };
}
