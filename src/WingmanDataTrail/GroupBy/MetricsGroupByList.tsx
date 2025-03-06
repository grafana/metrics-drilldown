import {
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  type SceneCSSGridItem,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';

import { MetricsGroupByRow } from './MetricsGroupByRow';

const NAMESPACES = ['flux-system', 'k8s-monitoring', 'oteldemo1', 'oteldemo3', 'oteldemo5'];

export class MetricsGroupByList extends EmbeddedScene {
  constructor() {
    super({
      key: 'metrics-group-list',
      body: new SceneFlexLayout({
        direction: 'column',
        children: [],
      }),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const children: Array<SceneObject<SceneObjectState> | SceneCSSGridItem> = [];
    for (const labelValue of NAMESPACES) {
      children.push(
        new SceneFlexItem({
          body: new MetricsGroupByRow({
            labelName: 'namespace',
            labelValue,
          }),
        })
      );
    }

    (this.state.body as SceneFlexLayout).setState({
      children,
    });
  }
}
