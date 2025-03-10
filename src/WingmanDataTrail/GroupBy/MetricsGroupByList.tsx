import {
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Alert, Spinner } from '@grafana/ui';
import React from 'react';

import { VAR_FILTERS, VAR_FILTERS_EXPR } from 'shared';
import { LabelsDataSource } from 'WingmanDataTrail/Labels/LabelsDataSource';

import { MetricsGroupByRow } from './MetricsGroupByRow';

interface MetricsGroupByListState extends SceneObjectState {
  body: SceneFlexLayout;
  labelName: string;
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

  constructor({ labelName }: { labelName: string }) {
    super({
      key: 'metrics-group-list',
      labelName,
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
    const { labelName } = this.state;
    let labelValues: string[] = [];

    this.setState({ loading: true });

    try {
      labelValues = await this.fetchLabelValues(labelName);
    } catch (error) {
      this.setState({ error: error as Error });
    } finally {
      this.setState({ loading: false });
    }

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

    const filterExpression = sceneGraph.interpolate(this, VAR_FILTERS_EXPR, {});

    const response = await ds.languageProvider.fetchSeriesValuesWithMatch(
      labelName,
      // `{__name__=~".+",$${VAR_FILTERS}}` // FIXME: the filters var is not interpolated, why?!
      `{__name__=~".+",${filterExpression}}`
    );

    return response;
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
