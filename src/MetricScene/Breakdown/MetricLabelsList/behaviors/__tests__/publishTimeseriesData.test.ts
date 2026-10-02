import { createDataFrame, FieldType, LoadingState, type DataFrame, type PanelData } from '@grafana/data';
import { SceneDataNode, SceneDataTransformer, VizPanel } from '@grafana/scenes';

import { sliceSeries } from '../../../../../shared/GmdVizPanel/types/timeseries/transformations/sliceSeries';
import { activateFullSceneTree } from '../../../../../shared/utils/utils.testing';
import { EventTimeseriesDataReceived } from '../../events/EventTimeseriesDataReceived';
import { publishTimeseriesData } from '../publishTimeseriesData';

function makeFrame(refId: string, value: number): DataFrame {
  return createDataFrame({
    refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: [1000, 2000] },
      { name: 'Value', type: FieldType.number, values: [value, value] },
    ],
  });
}

function makePanelData(series: DataFrame[]): PanelData {
  return {
    state: LoadingState.Done,
    series,
    timeRange: {} as PanelData['timeRange'],
  };
}

describe('publishTimeseriesData', () => {
  it('publishes the transformed series a group-by panel actually draws, not the untransformed series behind it', async () => {
    // Mirrors buildGroupByPanel: a raw response with a series beyond what sliceSeries(0, 1) keeps.
    const rawSeries = [makeFrame('kept', 1), makeFrame('dropped', 999999)];
    const $data = new SceneDataTransformer({
      $data: new SceneDataNode({ data: makePanelData(rawSeries) }),
      transformations: [sliceSeries(0, 1)],
    });

    const panel = new VizPanel({ pluginId: 'timeseries', $data });

    const receivedValues: number[][] = [];
    panel.subscribeToEvent(EventTimeseriesDataReceived, (event) => {
      receivedValues.push(event.payload.series.map((s) => s.fields[1].values[0]));
    });

    // Activate the data chain, then invoke the behavior directly, the same way the Scenes
    // framework invokes a $behaviors entry on activation, without activating the VizPanel itself
    // (VizPanel.activate() resolves its panel plugin, which needs a running Grafana instance).
    activateFullSceneTree($data);
    publishTimeseriesData()(panel);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(receivedValues).toEqual([[1]]);
  });

  it('does nothing for a panel that is not pluginId timeseries', () => {
    const $data = new SceneDataTransformer({
      $data: new SceneDataNode({ data: makePanelData([makeFrame('a', 1)]) }),
      transformations: [sliceSeries(0, 1)],
    });

    const panel = new VizPanel({ pluginId: 'table', $data });

    const receivedValues: unknown[] = [];
    panel.subscribeToEvent(EventTimeseriesDataReceived, (event) => {
      receivedValues.push(event.payload.series);
    });

    activateFullSceneTree($data);
    publishTimeseriesData()(panel);

    expect(receivedValues).toEqual([]);
  });
});
