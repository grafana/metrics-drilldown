import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneVariableSet,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricsGroupByList } from 'WingmanDataTrail/GroupBy/MetricsGroupByList';
import { LayoutSwitcher } from 'WingmanDataTrail/HeaderControls/LayoutSwitcher';
import { QuickSearch } from 'WingmanDataTrail/HeaderControls/QuickSearch';
import { SimpleMetricsList } from 'WingmanDataTrail/MetricsList/SimpleMetricsList';

import { MainLabelVariable } from './HeaderControls/MainLabelVariable';

interface MetricsOnboardingState extends SceneObjectState {
  headerControls: SceneFlexLayout;
  body?: SceneObjectBase;
}

export class MetricsOnboarding extends SceneObjectBase<MetricsOnboardingState> {
  constructor() {
    const quickSearch = new QuickSearch();
    const layoutSwitcher = new LayoutSwitcher();

    super({
      key: 'metrics-onboarding',
      $variables: new SceneVariableSet({
        variables: [new MainLabelVariable()],
      }),
      headerControls: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            body: new SceneFlexLayout({
              direction: 'row',
              maxHeight: '32px',
              children: [
                new SceneFlexItem({
                  body: quickSearch,
                }),
                new SceneFlexItem({
                  body: layoutSwitcher,
                  width: 'auto',
                }),
              ],
            }),
          }),
        ],
      }),
      body: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const mainLabelVariable = this.state.$variables!.state.variables[0] as MainLabelVariable;

    this.updateBody(mainLabelVariable.state.value as string);

    this._subs.add(
      mainLabelVariable.subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          this.updateBody(newState.value as string);
        }
      })
    );
  }

  private updateBody(groupBy: string) {
    this.setState({
      body: !groupBy
        ? (new SimpleMetricsList() as unknown as SceneObjectBase)
        : (new MetricsGroupByList() as unknown as SceneObjectBase),
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsOnboarding>) => {
    const styles = useStyles2(getStyles);
    const { body, headerControls, $variables } = model.useState();
    const mainLabelVariable = $variables?.state.variables[0] as MainLabelVariable;

    return (
      <div className={styles.container}>
        <div className={styles.headerControls}>
          <div className={styles.mainLabelVariable}>
            <mainLabelVariable.Component model={mainLabelVariable} />
          </div>

          <div className={styles.listControls}>
            <headerControls.Component model={headerControls} />
          </div>
        </div>
        <div className={styles.content}>
          <div className={styles.mainContent}>{body && <body.Component model={body} />}</div>
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
    headerControls: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      marginTop: theme.spacing(2),
    }),
    mainLabelVariable: css({}),
    listControls: css({}),
    content: css({
      display: 'flex',
      flexGrow: 1,
      gap: theme.spacing(2),
      height: '100%',
      overflow: 'hidden',
    }),
    sidebar: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      padding: theme.spacing(1),
      width: '250px',
      height: '100%',
      overflow: 'hidden',
      borderRadius: theme.shape.radius.default,
      borderRight: `1px solid ${theme.colors.border.weak}`,
    }),
    mainContent: css({
      flexGrow: 1,
      overflow: 'auto',
      padding: theme.spacing(1),
    }),
  };
}
