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
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { GroupBySelector } from './GroupBySelector';
import { RefreshMetricsEvent, VAR_FILTERS, VAR_GROUP_BY } from '../shared';
import { createGroupBySelectorPropsForMetrics } from './GroupBySelector/metrics-adapter';
import { isAdHocFiltersVariable, isQueryVariable } from '../utils/utils.variables';
import { MetricLabelsList } from './MetricLabelsList/MetricLabelsList';
import { MetricLabelValuesList } from './MetricLabelValuesList/MetricLabelValuesList';

interface LabelBreakdownSceneState extends SceneObjectState {
  metric: string;
  body?: MetricLabelsList | MetricLabelValuesList;
}

export class LabelBreakdownScene extends SceneObjectBase<LabelBreakdownSceneState> {
  constructor({ metric }: { metric: LabelBreakdownSceneState['metric'] }) {
    super({
      metric,
      body: undefined,
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

  public static readonly Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const styles = useStyles2(getStyles);
    const { body } = model.useState();
    const groupByVariable = model.getVariable();

    // Get filters variable for integration with the new component
    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, model);

    // Create props for the new GroupBySelector using the metrics adapter
    const selectorProps = createGroupBySelectorPropsForMetrics({
      groupByVariable,
      filtersVariable: isAdHocFiltersVariable(filtersVariable) ? filtersVariable : undefined,
      showAll: true,
      fieldLabel: "By label"
    });

    return (
      <div className={styles.container}>
        <div className={styles.controls}>
          <GroupBySelector {...selectorProps} />
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
      height: '70px',
      justifyContent: 'space-between',
      alignItems: 'end',
    }),
    searchField: css({
      flexGrow: 1,
    }),
  };
}
