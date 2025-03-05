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
import { ApplyAction } from 'WingmanDataTrail/MetricVizPanel/actions/ApplyAction';
import { ConfigureAction } from 'WingmanDataTrail/MetricVizPanel/actions/ConfigureAction';
import { EventApplyFunction } from 'WingmanDataTrail/MetricVizPanel/actions/EventApplyFunction';
import { EventConfigureFunction } from 'WingmanDataTrail/MetricVizPanel/actions/EventConfigureFunction';
import { VAR_METRICS_VARIABLE } from 'WingmanDataTrail/MetricVizPanel/MetricsVariable';
import {
  METRICS_VIZ_PANEL_HEIGHT,
  METRICS_VIZ_PANEL_HEIGHT_SMALL,
  MetricVizPanel,
} from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';
import { SceneDrawer } from 'WingmanDataTrail/SceneDrawer';

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';
const GRID_TEMPLATE_ROWS = '1fr';

interface SimpleMetricsListState extends SceneObjectState {
  body: SceneByVariableRepeater;
  drawer: SceneDrawer;
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
          autoRows: METRICS_VIZ_PANEL_HEIGHT,
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
      drawer: new SceneDrawer({}),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.subscribeToLayoutChange();
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    this._subs.add(
      this.subscribeToEvent(EventConfigureFunction, (event) => {
        this.openDrawer(event.payload.metricName);
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventApplyFunction, (event) => {
        this.state.drawer.close();
      })
    );
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

  private openDrawer(metricName: string) {
    this.state.drawer.open({
      title: 'Choose a new Prometheus function',
      subTitle: metricName,
      body: new SceneCSSGridLayout({
        templateColumns: GRID_TEMPLATE_COLUMNS,
        autoRows: METRICS_VIZ_PANEL_HEIGHT_SMALL,
        isLazy: true,
        $behaviors: [
          new behaviors.CursorSync({
            key: 'metricCrosshairSync',
            sync: DashboardCursorSync.Crosshair,
          }),
        ],
        children: ConfigureAction.PROMETHEUS_FN_OPTIONS.map(
          (option, colorIndex) =>
            new SceneCSSGridItem({
              body: new MetricVizPanel({
                title: option.label,
                metricName,
                color: getColorByIndex(colorIndex),
                groupByLabel: undefined,
                prometheusFunction: option.value as string,
                height: METRICS_VIZ_PANEL_HEIGHT_SMALL,
                hideLegend: true,
                highlight: colorIndex === 1,
                headerActions: [
                  new ApplyAction({
                    metricName,
                    prometheusFunction: option.value as string,
                    disabled: colorIndex === 1,
                  }),
                ],
              }),
            })
        ),
      }),
    });
  }

  public static Component = ({ model }: SceneComponentProps<SimpleMetricsList>) => {
    const styles = useStyles2(getStyles);
    const { body, drawer } = model.useState();

    return (
      <div className={styles.container}>
        <body.Component model={body} />
        <drawer.Component model={drawer} />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({}),
  };
}
