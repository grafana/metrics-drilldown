import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import {
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricsGroupByList } from './GroupBy/MetricsGroupByList';
import { HeaderControls } from './HeaderControls/HeaderControls';
import { NULL_GROUP_BY_VALUE } from './Labels/LabelsDataSource';
import { VAR_WINGMAN_GROUP_BY, type LabelsVariable } from './Labels/LabelsVariable';
import { SimpleMetricsList } from './MetricsList/SimpleMetricsList';
import { registerRuntimeDataSources } from './registerRuntimeDataSources';
import { SideBar } from './SideBar/SideBar';

interface MetricsReducerState extends SceneObjectState {
  headerControls: HeaderControls;
  sidebar: SideBar;
  body: SceneObjectBase;
}

export class MetricsReducer extends SceneObjectBase<MetricsReducerState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_WINGMAN_GROUP_BY],
    onReferencedVariableValueChanged: (variable) => {
      this.updateBodyBasedOnGroupBy((variable as LabelsVariable).state.value as string);
    },
  });

  public constructor() {
    super({
      headerControls: new HeaderControls({}),
      sidebar: new SideBar({}),
      body: new SimpleMetricsList() as unknown as SceneObjectBase,
    });

    registerRuntimeDataSources();

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const labelsVariable = sceneGraph.lookupVariable(VAR_WINGMAN_GROUP_BY, this) as LabelsVariable;

    this.updateBodyBasedOnGroupBy(labelsVariable.state.value as string);
  }

  private updateBodyBasedOnGroupBy(groupByValue: string) {
    this.setState({
      body:
        !groupByValue || groupByValue === NULL_GROUP_BY_VALUE
          ? (new SimpleMetricsList() as unknown as SceneObjectBase)
          : (new MetricsGroupByList({ labelName: groupByValue }) as unknown as SceneObjectBase),
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsReducer>) => {
    const styles = useStyles2(getStyles);
    const { body, headerControls, sidebar } = model.useState();
    const chromeHeaderHeight = useChromeHeaderHeight() ?? 0;

    return (
      <div
        className={styles.container}
        style={{
          height: `calc(100vh - ${chromeHeaderHeight}px)`,
        }}
      >
        <div className={styles.headerControls}>
          <headerControls.Component model={headerControls} />
        </div>
        <div className={styles.sidebar}>
          <sidebar.Component model={sidebar} />
        </div>
        <div className={styles.mainContent}>
          <body.Component model={body} />
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  const headerHeight = 55; // Height of our header controls

  return {
    container: css({
      display: 'grid',
      gridTemplateRows: `${headerHeight}px calc(100% - ${headerHeight}px)`,
      gridTemplateColumns: '250px 1fr',
      gridTemplateAreas: `
        'header header'
        'sidebar content'
      `,
      height: '100%',
      overflow: 'hidden',
      position: 'relative',
    }),
    headerControls: css({
      gridArea: 'header',
      background: theme.colors.background.primary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(1, 0),
      zIndex: theme.zIndex.navbarFixed,
      position: 'sticky',
      top: 0,
    }),
    sidebar: css({
      gridArea: 'sidebar',
      background: theme.colors.background.primary,
      borderRight: `1px solid ${theme.colors.border.weak}`,
      overflow: 'auto',
      height: '100%',
    }),
    mainContent: css({
      gridArea: 'content',
      overflow: 'auto',
      padding: theme.spacing(1),
      height: '100%',
    }),
  };
}
