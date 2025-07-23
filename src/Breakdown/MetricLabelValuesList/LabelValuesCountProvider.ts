import { sceneGraph } from '@grafana/scenes';

import {
  CountsProvider,
  type CountsProviderState,
} from 'WingmanDataTrail/ListControls/QuickSearch/CountsProvider/CountsProvider';

import { SceneByFrameRepeater } from './SceneByFrameRepeater';

export class LabelValuesCountsProvider extends CountsProvider<CountsProviderState> {
  constructor() {
    super({ key: 'LabelValuesCountsProvider' });

    this.addActivationHandler(() => {
      const byFrameRepeater = sceneGraph.findByKeyAndType(this, 'breakdown-by-frame-repeater', SceneByFrameRepeater);

      byFrameRepeater.subscribeToState((newState, prevState) => {
        if (newState.counts !== prevState.counts) {
          this.setState({ counts: newState.counts });
        }
      });
    });
  }
}
