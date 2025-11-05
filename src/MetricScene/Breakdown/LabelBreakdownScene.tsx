import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { config, useChromeHeaderHeight } from '@grafana/runtime';
import {
  behaviors,
  sceneGraph,
  SceneObjectBase,
  type QueryVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { type DataTrail } from 'AppDataTrail/DataTrail';
import { getMetricType } from 'shared/GmdVizPanel/matchers/getMetricType';
import { getTrailFor } from 'shared/utils/utils';
import { getAppBackgroundColor } from 'shared/utils/utils.styles';

import { MetricLabelsList } from './MetricLabelsList/MetricLabelsList';
import { MetricLabelValuesList } from './MetricLabelValuesList/MetricLabelValuesList';
import { actionViews } from '../../MetricScene/MetricActionBar';
import { RefreshMetricsEvent, VAR_GROUP_BY } from '../../shared/shared';
import { isQueryVariable } from '../../shared/utils/utils.variables';
import { signalOnQueryComplete } from '../utils/signalOnQueryComplete';

interface LabelBreakdownSceneState extends SceneObjectState {
  metric: string;
  body?: MetricLabelsList | MetricLabelValuesList;
}

export class LabelBreakdownScene extends SceneObjectBase<LabelBreakdownSceneState> {
  constructor({ metric }: { metric: LabelBreakdownSceneState['metric'] }) {
    super({
      metric,
      body: undefined,
      $behaviors: [new behaviors.SceneQueryController()],
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
      this.subscribeToEvent(RefreshMetricsEvent, () => {
        this.updateBody(groupByVariable);
      });
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

  private async updateBody(groupByVariable: QueryVariable) {
    const { metric: name } = this.state;

    const metric = {
      name,
      type: await getMetricType(name, getTrailFor(this)),
    };

    const newBody = groupByVariable.hasAllValue()
      ? new MetricLabelsList({ metric })
      : new MetricLabelValuesList({ metric, label: groupByVariable.state.value as string });

    this.setState({ body: newBody });

    // Wait for body activation, then signal when queries complete
    if (newBody.isActive) {
      signalOnQueryComplete(this, actionViews.breakdown);
    } else {
      newBody.addActivationHandler(() => {
        signalOnQueryComplete(this, actionViews.breakdown);
      });
    }
  }

  public static readonly Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const chromeHeaderHeight = useChromeHeaderHeight();
    const trail = getTrailFor(model);
    const styles = useStyles2(getStyles, trail.state.embedded ? 0 : chromeHeaderHeight ?? 0, trail);
    const { body } = model.useState();
    const groupByVariable = model.getVariable();

    return (
      <div className={styles.container}>
        <div className={styles.stickyControls} data-testid="breakdown-controls">
          <div className={styles.controls}>
            <groupByVariable.Component model={groupByVariable} />
            {body instanceof MetricLabelsList && <body.Controls model={body} />}
            {body instanceof MetricLabelValuesList && <body.Controls model={body} />}
          </div>
        </div>
        <div data-testid="panels-list">
          {body instanceof MetricLabelsList && <body.Component model={body} />}
          {body instanceof MetricLabelValuesList && <body.Component model={body} />}
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, headerHeight: number, trail: DataTrail) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
    }),
    stickyControls: css({
      margin: theme.spacing(1, 0, 1.5, 0),
      position: 'sticky',
      top: `calc(var(--app-controls-height, 0px) + ${headerHeight}px + var(--action-bar-height, 0px))`,
      zIndex: 10,
      background: getAppBackgroundColor(theme, trail),
      paddingBottom: theme.spacing(1),
    }),
    controls: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'end',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
    }),
    searchField: css({
      flexGrow: 1,
    }),
  };
}
