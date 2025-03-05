import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  behaviors,
  SceneByVariableRepeater,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { WithUsageDataPreviewPanel } from 'MetricSelect/WithUsageDataPreviewPanel';
import { getColorByIndex } from 'utils';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'WingmanDataTrail/HeaderControls/LayoutSwitcher';
import { VAR_METRICS_VARIABLE } from 'WingmanDataTrail/MetricVizPanel/MetricsVariable';
import { MetricVizPanel } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';
const GRID_TEMPLATE_ROWS = '1fr';

interface SimpleMetricsListState extends SceneObjectState {
  body: SceneByVariableRepeater;
}

export class SimpleMetricsList extends SceneObjectBase<SimpleMetricsListState> {
  constructor() {
    let colorIndex = 0;

    super({
      key: 'simple-metrics-list',
      body: new SceneByVariableRepeater({
        variableName: VAR_METRICS_VARIABLE,
        body: new SceneCSSGridLayout({
          children: [],
          templateColumns: GRID_TEMPLATE_COLUMNS,
          autoRows: '240px',
          alignItems: 'start',
          isLazy: true,
          rowGap: 6,
          $behaviors: [
            new behaviors.CursorSync({
              key: 'metricCrosshairSync',
              sync: DashboardCursorSync.Crosshair,
            }),
          ],
        }),
        getLayoutChild: (option) => {
          // Scenes does not pass an index :man_shrug: :sad_panda:
          return new SceneCSSGridItem({
            body: new WithUsageDataPreviewPanel({
              vizPanelInGridItem: new MetricVizPanel({
                metricName: option.value as string,
                color: getColorByIndex(colorIndex++),
                groupByLabel: undefined,
              }),
              metric: option.value as string,
            }),
          });
        },
      }),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.subscribeToLayoutChange();
  }

  private subscribeToLayoutChange() {
    const layoutSwitcher = sceneGraph.findByKeyAndType(this, 'layout-switcher', LayoutSwitcher);
    const body = this.state.body.state.body as SceneCSSGridLayout;

    const onChangeState = (newState: LayoutSwitcherState, prevState?: LayoutSwitcherState) => {
      if (newState.layout !== prevState?.layout) {
        body.setState({
          templateColumns: newState.layout === LayoutType.ROWS ? GRID_TEMPLATE_ROWS : GRID_TEMPLATE_COLUMNS,
        });
      }
    };

    onChangeState(layoutSwitcher.state); // ensure layout when landing on the page

    this._subs.add(layoutSwitcher.subscribeToState(onChangeState));
  }

  public static Component = ({ model }: SceneComponentProps<SimpleMetricsList>) => {
    const styles = useStyles2(getStyles);
    const { body } = model.useState();

    return (
      <div className={styles.container}>
        <body.Component model={body} />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({}),
  };
}
