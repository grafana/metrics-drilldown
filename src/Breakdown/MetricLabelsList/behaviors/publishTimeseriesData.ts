import { LoadingState } from '@grafana/data';
import { SceneDataTransformer, sceneGraph, type SceneDataProvider, type VizPanel } from '@grafana/scenes';

import { EventTimeseriesDataReceived } from '../events/EventTimeseriesDataReceived';

/**
 * Publishes timeseries data events when new data arrives from the VizPanel data provider.
 * These events are used by other behaviors like syncYAxis to coordinate updates across multiple panels.
 */
export function publishTimeseriesData() {
  return (vizPanel: VizPanel) => {
    let $data = sceneGraph.getData(vizPanel);
    if ($data instanceof SceneDataTransformer) {
      $data = $data.state.$data as SceneDataProvider;
    }
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

    ($data as SceneDataProvider).subscribeToState((newState, prevState) => {
      if (
        newState.data?.state === LoadingState.Done &&
        newState.data.series?.length &&
        newState.data?.series !== prevState.data?.series
      ) {
        vizPanel.publishEvent(
          new EventTimeseriesDataReceived({
            panelKey: vizPanel.state.key as string,
            series: newState.data.series,
          }),
          true
        );
      }
    });
  };
}
