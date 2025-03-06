import {
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import React from 'react';

import { LabelsDataSource } from 'WingmanDataTrail/Labels/LabelsDataSource';

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

    this.addActivationHandler(() => {
      this.onActivate();
    });
  }

  private async onActivate() {
    const { labelName } = this.state;

    // TODO: handle loading and errors
    const labelValues = await this.fetchLabelValues(labelName);

    this.state.body.setState({
      children: labelValues.map(
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

  async fetchLabelValues(labelName: string): Promise<string[]> {
    const ds = await LabelsDataSource.getPrometheusDataSource(this);
    if (!ds) {
      return [];
    }

    const response = await ds.languageProvider.fetchLabelValues(labelName);

    return response;
  }

  static Component = ({ model }: SceneComponentProps<MetricsGroupByList>) => {
    const { body } = model.state;

    return <body.Component model={body} />;
  };
}
