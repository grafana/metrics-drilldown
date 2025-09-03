import { LoadingState } from '@grafana/data';
import {
  sceneGraph,
  SceneQueryRunner,
  type CancelActivationHandler,
  type VizPanel,
  type VizPanelState,
} from '@grafana/scenes';

import { MAX_SERIES_TO_RENDER_WHEN_GROUPED_BY } from '../buildTimeseriesPanel';

const DEFAULT_CTA_TEXT_IN_DESCRIPTION = `Click on "Select" on this panel to view a breakdown of all the label's values.`;

type Options = {
  description?: {
    ctaText?: string;
  } | null;
};

export const addCardinalityInfo =
  (options: Options = {}) =>
  (panel: VizPanel): CancelActivationHandler | void => {
    const [queryRunner] = sceneGraph.findDescendents(panel, SceneQueryRunner);
    if (!queryRunner) {
      return;
    }

    const originalTitle = panel.state.title;

    const dataSub = queryRunner.subscribeToState((newState) => {
      if (newState.data?.state !== LoadingState.Done) {
        return;
      }

      const { series } = newState.data;
      if (!series?.length) {
        return;
      }

      const stateUpdate: Partial<VizPanelState> = {
        title: `${originalTitle} (${series.length})`,
      };

      if (options.description !== null && series.length > MAX_SERIES_TO_RENDER_WHEN_GROUPED_BY) {
        stateUpdate.description = `Showing only ${MAX_SERIES_TO_RENDER_WHEN_GROUPED_BY} series out of ${series.length} to keep the data easy to read.`;
        stateUpdate.description +=
          typeof options.description?.ctaText === 'string'
            ? ` ${options.description?.ctaText}`
            : ` ${DEFAULT_CTA_TEXT_IN_DESCRIPTION}`;
      }

      panel.setState(stateUpdate);
    });

    return () => {
      dataSub.unsubscribe();
    };
  };
