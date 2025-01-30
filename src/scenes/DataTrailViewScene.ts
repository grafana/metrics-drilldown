import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { createElement } from 'react';

import { DataTrailView } from '../components/DataTrailView';
import { type DataTrail } from '../DataTrail';

interface DataTrailViewSceneState extends SceneObjectState {
  trail: DataTrail;
}

export class DataTrailViewScene extends SceneObjectBase<DataTrailViewSceneState> {
  static Component = ({ model }: SceneComponentProps<DataTrailViewScene>) => {
    const { trail } = model.state;
    return createElement(DataTrailView, { trail: trail });
  };
}
