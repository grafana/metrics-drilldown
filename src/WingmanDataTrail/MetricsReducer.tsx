import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  CustomVariable,
  sceneGraph,
  SceneObjectBase,
  SceneVariableSet,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricsGroupByList } from './GroupBy/MetricsGroupByList';
import { groupByOptions, VAR_GROUP_BY } from './HeaderControls/GroupByControls';
import { HeaderControls } from './HeaderControls/HeaderControls';
import { SimpleMetricsList } from './MetricsList/SimpleMetricsList';
import { SideBar } from './SideBar/SideBar';

interface MetricsReducerState extends SceneObjectState {
  headerControls: HeaderControls;
  sidebar: SideBar;
  body: SceneObjectBase;
  groupBy: string;
}

export class MetricsReducer extends SceneObjectBase<MetricsReducerState> {
  public constructor() {
    super({
      headerControls: new HeaderControls({}),
      groupBy: 'cluster',
      sidebar: new SideBar({}),
      body: new SimpleMetricsList() as unknown as SceneObjectBase,
      $variables: new SceneVariableSet({
        variables: [
          new CustomVariable({
            name: VAR_GROUP_BY,
            label: 'Group By',
            value: 'cluster', // Default value
            query: groupByOptions.map((option) => `${option.label} : ${option.value}`).join(','),
          }),
        ],
      }),
    });

    // Add activation handler to listen for groupBy variable changes
    this.addActivationHandler(() => this.activationHandler());
  }

  private activationHandler() {
    const variables = sceneGraph.getVariables(this);
    const groupByVar = variables.getByName(VAR_GROUP_BY);

    if (groupByVar) {
      // Set initial state based on the current value
      const currentValue = groupByVar.getValue() as string;
      this.updateBodyBasedOnGroupBy(currentValue);

      // Subscribe to VAR_GROUP_BY changes
      this._subs.add(
        groupByVar.subscribeToState((state: any) => {
          const value = state.value || state.getValue?.();
          if (value) {
            this.updateBodyBasedOnGroupBy(value as string);
          }
        })
      );
    }
  }

  private updateBodyBasedOnGroupBy(groupByValue: string) {
    this.setState({
      groupBy: groupByValue,
      body:
        !groupByValue || groupByValue === 'none'
          ? (new SimpleMetricsList() as unknown as SceneObjectBase)
          : (new MetricsGroupByList() as unknown as SceneObjectBase),
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsReducer>) => {
    const styles = useStyles2(getStyles);
    const { body, headerControls, sidebar } = model.useState();

    return (
      <div className={styles.container}>
        <div className={styles.headerControls}>
          <headerControls.Component model={headerControls} />
        </div>
        <div className={styles.content}>
          <sidebar.Component model={sidebar} />

          <div className={styles.mainContent}>
            <body.Component model={body} />
          </div>
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: theme.spacing(1),
    }),
    headerControls: css({}),
    content: css({
      display: 'flex',
      flexGrow: 1,
      gap: theme.spacing(2),
      height: '100%',
      overflow: 'hidden',
    }),
    mainContent: css({
      flexGrow: 1,
      overflow: 'auto',
      padding: theme.spacing(1),
    }),
  };
}
