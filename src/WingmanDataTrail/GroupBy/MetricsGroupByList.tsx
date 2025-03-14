import {
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Alert, Spinner } from '@grafana/ui';
import React from 'react';

import { VAR_FILTERS } from 'shared';
import { LabelsDataSource } from 'WingmanDataTrail/Labels/LabelsDataSource';

import { MetricsGroupByRow } from './MetricsGroupByRow';

interface MetricsGroupByListState extends SceneObjectState {
  body: SceneFlexLayout;
  labelName: string;
  labelValues?: string[];
  loading: boolean;
  error?: Error;
}

export class MetricsGroupByList extends SceneObjectBase<MetricsGroupByListState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS],
    onVariableUpdateCompleted: () => {
      this.renderBody();
    },
  });

  constructor({
    labelName,
    labelValues,
  }: {
    labelName: MetricsGroupByListState['labelName'];
    labelValues?: MetricsGroupByListState['labelValues'];
  }) {
    super({
      key: 'metrics-group-list',
      labelName,
      labelValues,
      body: new SceneFlexLayout({
        direction: 'column',
        children: [],
      }),
      loading: true,
      error: undefined,
    });

    this.addActivationHandler(() => {
      this.onActivate();
    });
  }

  private async onActivate() {
    await this.renderBody();
  }

  async renderBody() {
    const { labelName, labelValues } = this.state;
    let values = labelValues;

    if (!values) {
      values = await this.fetchLabelValues(labelName);
    } else {
      this.setState({ loading: false });
    }

    this.state.body.setState({
      children: values.map(
        (labelValue, index) =>
          new SceneFlexItem({
            body: new MetricsGroupByRow({
              index,
              labelName,
              labelValue,
              labelCardinality: values.length,
            }),
          })
      ),
    });
  }

  async fetchLabelValues(labelName: string) {
    let labelValues: string[] = [];

    this.setState({ loading: true });

    try {
      labelValues = await LabelsDataSource.fetchLabelValues(labelName, this);
    } catch (error) {
      this.setState({ error: error as Error });
    } finally {
      this.setState({ loading: false });
    }

    return labelValues;
  }

  static Component = ({ model }: SceneComponentProps<MetricsGroupByList>) => {
    const { body, loading, error, labelName } = model.useState();

    if (loading) {
      return <Spinner inline />;
    }

    if (error) {
      return (
        <Alert severity="error" title={`Error while loading "${labelName}" values!`}>
          <p>&quot;{error.message || error.toString()}&quot;</p>
          <p>Please try to reload the page. Sorry for the inconvenience.</p>
        </Alert>
      );
    }

    return <body.Component model={body} />;
  };
}
