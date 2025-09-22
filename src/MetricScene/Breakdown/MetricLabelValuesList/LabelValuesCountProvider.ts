import { sceneGraph } from '@grafana/scenes';

import { CountsProvider } from 'WingmanDataTrail/ListControls/QuickSearch/CountsProvider/CountsProvider';

import { SceneByFrameRepeater } from './SceneByFrameRepeater';

export class LabelValuesCountsProvider extends CountsProvider {
  constructor() {
    super({ key: 'LabelValuesCountsProvider' });

    this.addActivationHandler(() => {
      const byFrameRepeater = sceneGraph.findByKeyAndType(this, 'breakdown-by-frame-repeater', SceneByFrameRepeater);

      this._subs.add(
        byFrameRepeater.subscribeToState((newState, prevState) => {
          if (newState.counts !== prevState.counts) {
            this.setState({ counts: newState.counts });
          }
        })
      );
    });
  }
}
