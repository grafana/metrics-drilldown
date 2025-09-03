import { LoadingState } from '@grafana/data';
import {
  SceneDataTransformer,
  sceneGraph,
  SceneQueryRunner,
  type CancelActivationHandler,
  type VizPanel,
} from '@grafana/scenes';

export const addCardinalityInfo =
  (originalTitle: string, maxSeriesToRender: number) =>
  (panel: VizPanel): CancelActivationHandler | void => {
    const [sceneDataTransformer] = sceneGraph.findDescendents(panel, SceneDataTransformer);
    if (sceneDataTransformer) {
      const { transformations } = sceneDataTransformer.state;
      // add the behaviour only if we slice the series received
      if (!transformations.find((t) => (t as Function).name === 'sliceSeries')) {
        return;
      }
    }

    const [queryRunner] = sceneGraph.findDescendents(panel, SceneQueryRunner);
    if (!queryRunner) {
      return;
    }

    const dataSub = queryRunner.subscribeToState((newState) => {
      if (newState.data?.state !== LoadingState.Done) {
        return;
      }
      const { series } = newState.data;
      if (!series?.length) {
        return;
      }

      const description =
        series.length > maxSeriesToRender
          ? `Showing only ${maxSeriesToRender} series out of ${series.length} to keep the data easy to read. Click on "Select" on this panel to view a breakdown of all the label's values.`
          : '';

      panel.setState({
        title: `${originalTitle} (${series.length})`,
        description,
      });
    });

    return () => {
      dataSub.unsubscribe();
    };
  };
