import {
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import React from 'react';

import { MetricsGroupByRow } from './MetricsGroupByRow';

interface MetricsGroupByListState extends SceneObjectState {
  body: SceneFlexLayout;
  labelName: string;
}

export class MetricsGroupByList extends SceneObjectBase<MetricsGroupByListState> {
  constructor({ labelName }: { labelName: string }) {
    super({
      key: 'metrics-group-list',
      labelName,
      body: new SceneFlexLayout({
        direction: 'column',
        children: [],
      }),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const { labelName } = this.state;

    // TEMP
    const NAMESPACES = ['flux-system', 'k8s-monitoring', 'oteldemo1', 'oteldemo3', 'oteldemo5'];

    this.state.body.setState({
      children: NAMESPACES.map(
        (labelValue) =>
          new SceneFlexItem({
            body: new MetricsGroupByRow({
              labelName,
              labelValue,
            }),
          })
      ),
    });
  }

  static Component = ({ model }: SceneComponentProps<MetricsGroupByList>) => {
    const { body } = model.state;

    return <body.Component model={body} />;
  };
}
