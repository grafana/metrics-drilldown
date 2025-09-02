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

import { RefreshMetricsEvent, VAR_GROUP_BY } from '../shared';
import { isQueryVariable } from '../utils/utils.variables';
import { MetricLabelsList } from './MetricLabelsList/MetricLabelsList';
import { MetricLabelValuesList } from './MetricLabelValuesList/MetricLabelValuesList';
import { ResponsiveGroupBySelector } from './ResponsiveGroupBySelector';

interface LabelBreakdownSceneState extends SceneObjectState {
  metric: string;
  body?: MetricLabelsList | MetricLabelValuesList;
  responsiveSelector?: ResponsiveGroupBySelector;
}

export class LabelBreakdownScene extends SceneObjectBase<LabelBreakdownSceneState> {
  constructor({ metric }: { metric: LabelBreakdownSceneState['metric'] }) {
    super({
      metric,
      body: undefined,
      responsiveSelector: new ResponsiveGroupBySelector(),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const groupByVariable = this.getVariable();

    groupByVariable.subscribeToState((newState, oldState) => {
      if (newState.value !== oldState.value) {
        this.updateBody(groupByVariable);
      }
    });

    if (config.featureToggles.enableScopesInMetricsExplore) {
      this._subs.add(
        this.subscribeToEvent(RefreshMetricsEvent, () => {
          this.updateBody(groupByVariable);
        })
      );
    }

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
    const { metric } = this.state;

    this.setState({
      body: groupByVariable.hasAllValue()
        ? new MetricLabelsList({ metric })
        : new MetricLabelValuesList({ metric, label: groupByVariable.state.value as string }),
    });
  }

  public getResponsiveSelector(): ResponsiveGroupBySelector {
    const { responsiveSelector } = this.state;
    if (!responsiveSelector) {
      throw new Error('ResponsiveGroupBySelector not initialized');
    }
    return responsiveSelector;
  }

  public static readonly Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const styles = useStyles2(getStyles);
    const { body } = model.useState();
    const groupByVariable = model.getVariable();
    const useResponsive = true;

    return (
      <div className={styles.container}>
        <div className={styles.controls}>
          {useResponsive ? (
            <div className={styles.responsiveGroupByWrapper}>
              <ResponsiveGroupBySelector.Component model={model.getResponsiveSelector()} />
            </div>
          ) : (
            <Field label="By label">
              <groupByVariable.Component model={groupByVariable} />
            </Field>
          )}
          {body instanceof MetricLabelsList && <body.Controls model={body} />}
          {body instanceof MetricLabelValuesList && <body.Controls model={body} />}
        </div>
        <div data-testid="panels-list">
          {body instanceof MetricLabelsList && <body.Component model={body} />}
          {body instanceof MetricLabelValuesList && <body.Component model={body} />}
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
      minHeight: '70px',
      padding: theme.spacing(1),
      alignItems: 'end',
      flexWrap: 'wrap',

      // Responsive stacking
      [theme.breakpoints.down('lg')]: {
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: theme.spacing(1),
        minHeight: 'auto',
      },
    }),
    searchField: css({
      flexGrow: 1,
    }),
    responsiveGroupByWrapper: css({
      // On large screens, give ResponsiveGroupBySelector a fixed flex-basis
      // to prevent layout shifts when other components appear/disappear
      [theme.breakpoints.up('lg')]: {
        flexBasis: '400px', // Fixed width for stable calculations
        flexShrink: 0,      // Prevent shrinking
        flexGrow: 0,        // Prevent growing
      },

      // On smaller screens, allow normal flex behavior
      [theme.breakpoints.down('lg')]: {
        flexBasis: 'auto',
        flexShrink: 1,
        flexGrow: 0,
      },
    }),
  };
}
