import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  sceneGraph,
  SceneObjectBase,
  type QueryVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Field, useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricScene } from '../MetricScene';
import { RefreshMetricsEvent, VAR_GROUP_BY } from '../shared';
import { isQueryVariable } from '../utils/utils.variables';
import { MetricLabelsList } from './MetricLabelsList/MetricLabelsList';
import { MetricLabelsValuesList } from './MetricLabelsValuesList/MetricLabelsValuesList';

export interface LabelBreakdownSceneState extends SceneObjectState {
  body?: MetricLabelsList | MetricLabelsValuesList;
}

export class LabelBreakdownScene extends SceneObjectBase<LabelBreakdownSceneState> {
  constructor() {
    super({});
    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const groupByVariable = this.getVariable();

    if (config.featureToggles.enableScopesInMetricsExplore) {
      this._subs.add(
        this.subscribeToEvent(RefreshMetricsEvent, () => {
          this.updateBody(groupByVariable);
        })
      );
    }

    groupByVariable.subscribeToState((newState, oldState) => {
      if (newState.value !== oldState.value) {
        this.updateBody(groupByVariable);
      }
    });

    this.updateBody(groupByVariable);
  }

  private getVariable(): QueryVariable {
    const groupByVariable = sceneGraph.lookupVariable(VAR_GROUP_BY, this)!;
    if (!isQueryVariable(groupByVariable)) {
      throw new Error('Group by variable not found');
    }
    return groupByVariable;
  }

  private updateBody(groupByVariable: QueryVariable) {
    const metricScene = sceneGraph.getAncestor(this, MetricScene);

    this.setState({
      body: groupByVariable.hasAllValue()
        ? new MetricLabelsList({ metric: metricScene.state.metric })
        : new MetricLabelsValuesList({
            metric: metricScene.state.metric,
            label: groupByVariable.state.value as string,
          }),
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const styles = useStyles2(getStyles);
    const { body } = model.useState();
    const variable = model.getVariable();

    return (
      <div className={styles.container}>
        <div className={styles.controls}>
          <Field label="By label">
            <variable.Component model={variable} />
          </Field>
          {body instanceof MetricLabelsList && <body.Controls model={body} />}
          {body instanceof MetricLabelsValuesList && <body.Controls model={body} />}
        </div>
        <div data-testid="panels-list">
          {body instanceof MetricLabelsList && <body.Component model={body} />}
          {body instanceof MetricLabelsValuesList && <body.Component model={body} />}
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
      paddingTop: theme.spacing(1),
    }),
    controls: css({
      flexGrow: 0,
      display: 'flex',
      gap: theme.spacing(2),
      height: '70px',
      justifyContent: 'space-between',
      alignItems: 'end',
    }),
    searchField: css({
      flexGrow: 1,
    }),
  };
}
