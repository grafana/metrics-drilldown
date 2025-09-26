import {
  sceneGraph,
  SceneQueryRunner,
  type CancelActivationHandler,
  type VizPanel,
  type VizPanelState,
} from '@grafana/scenes';

import { getColorByIndex } from 'shared/utils/utils';

/**
 * This behaviour acts when the number of queries of the query runner changes and adjust the color overrides.
 * This ensures the panel renders multiple timeseries correctly whenever the Prometheus function configuration changes (number of percentiles, ...).
 * See GmdVizPanel.updateQuery()
 */
export const updateColorsWhenQueriesChange =
  (startColorIndex = 0) =>
  (vizPanel: VizPanel): CancelActivationHandler | void => {
    const [queryRunner] = sceneGraph.findDescendents(vizPanel, SceneQueryRunner);
    if (!queryRunner) {
      return;
    }

    const dataSub = queryRunner.subscribeToState((newState, prevState) => {
      if (newState.queries !== prevState.queries) {
        const fieldConfig: VizPanelState['fieldConfig'] = {
          ...vizPanel.state.fieldConfig,
        };

        fieldConfig.defaults.color = undefined;
        fieldConfig.overrides = newState.queries.map((q, i) => {
          return {
            matcher: {
              id: 'byFrameRefID',
              options: q.refId,
            },
            properties: [
              {
                id: 'color',
                value: { mode: 'fixed', fixedColor: getColorByIndex(startColorIndex + i) },
              },
            ],
          };
        });

        vizPanel.setState({ fieldConfig });
      }
    });

    return () => {
      dataSub.unsubscribe();
    };
  };
