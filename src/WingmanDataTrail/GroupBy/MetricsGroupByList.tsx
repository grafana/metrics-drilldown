import {
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import React from 'react';

import { VAR_FILTERS } from 'shared';
import { LabelsDataSource } from 'WingmanDataTrail/Labels/LabelsDataSource';

import { MetricsGroupByRow } from './MetricsGroupByRow';

interface MetricsGroupByListState extends SceneObjectState {
  body: SceneFlexLayout;
  labelName: string;
}

export class MetricsGroupByList extends SceneObjectBase<MetricsGroupByListState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS],
    onVariableUpdateCompleted: () => {
      this.renderBody();
    },
  });

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
    this.renderBody();
  }

  async renderBody() {
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

    const response = await ds.languageProvider.fetchSeriesValuesWithMatch(
      labelName,
      `{__name__=~".+",\$${VAR_FILTERS}}`
    );

    return response;
  }

  static Component = ({ model }: SceneComponentProps<MetricsGroupByList>) => {
    const { body } = model.state;

    return <body.Component model={body} />;
  };
}
