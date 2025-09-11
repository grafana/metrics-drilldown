import { LoadingState } from '@grafana/data';
import { SceneDataTransformer, sceneGraph, type SceneDataProvider, type VizPanel } from '@grafana/scenes';

import { EventTimeseriesDataReceived } from '../events/EventTimeseriesDataReceived';

/**
 * Publishes timeseries data events when new data arrives from the VizPanel data provider.
 * These events are used by the syncYAxis behaviour to coordinate updates across multiple panels.
 */
export function publishTimeseriesData() {
  return (vizPanel: VizPanel) => {
    if (vizPanel.state.pluginId !== 'timeseries') {
      return;
    }

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
