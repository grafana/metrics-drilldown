import { LoadingState } from '@grafana/data';
import { type SceneDataProvider, type VizPanel } from '@grafana/scenes';

import { EventTimeseriesDataReceived } from '../events/EventTimeseriesDataReceived';

/**
 * Publishes timeseries data events when new data arrives from the VizPanel data provider.
 * These events are used by other behaviors like syncYAxis to coordinate updates across multiple panels.
 */
export function publishTimeseriesData() {
  return (vizPanel: VizPanel) => {
    const data = vizPanel.state.$data?.state.data;

    if (data?.state === LoadingState.Done) {
      vizPanel.publishEvent(new EventTimeseriesDataReceived({ series: data.series }), true);
    }

    (vizPanel.state.$data as SceneDataProvider).subscribeToState((newState, prevState) => {
      if (newState.data?.state === LoadingState.Done && newState.data?.series !== prevState.data?.series) {
        vizPanel.publishEvent(new EventTimeseriesDataReceived({ series: newState.data.series }), true);
      }
    });
  };
}
