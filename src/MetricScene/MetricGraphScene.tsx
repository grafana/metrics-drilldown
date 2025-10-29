import { css, cx } from '@emotion/css';
import { DashboardCursorSync, type GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import {
  behaviors,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { useResizeObserver } from '@react-aria/utils';
import React, { useRef } from 'react';

import { type DataTrail } from 'AppDataTrail/DataTrail';
import { getMetricDescription } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { AddToDashboardAction } from 'shared/GmdVizPanel/components/AddToDashboardAction';
import { BookmarkHeaderAction } from 'shared/GmdVizPanel/components/BookmarkHeaderAction';
import { ConfigurePanelAction } from 'shared/GmdVizPanel/components/ConfigurePanelAction';
import { GmdVizPanelVariantSelector } from 'shared/GmdVizPanel/components/GmdVizPanelVariantSelector';
import { PANEL_HEIGHT } from 'shared/GmdVizPanel/config/panel-heights';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { isClassicHistogramMetric } from 'shared/GmdVizPanel/matchers/isClassicHistogramMetric';

import { MetricActionBar } from './MetricActionBar';
import { PanelMenu } from './PanelMenu/PanelMenu';
import { getTrailFor } from '../shared/utils/utils';
import { getAppBackgroundColor } from '../shared/utils/utils.styles';

const MAIN_PANEL_MIN_HEIGHT = PANEL_HEIGHT.XL;
const MAIN_PANEL_MAX_HEIGHT = '40%';

export const TOPVIEW_PANEL_MENU_KEY = 'topview-panel-menu';

interface MetricGraphSceneState extends SceneObjectState {
  metric: string;
  topView: SceneFlexLayout;
  selectedTab?: SceneObject;
  actionBar: MetricActionBar;
}

export class MetricGraphScene extends SceneObjectBase<MetricGraphSceneState> {
  public constructor({ metric }: { metric: MetricGraphSceneState['metric'] }) {
    super({
      metric,
      topView: new SceneFlexLayout({
        direction: 'column',
        $behaviors: [new behaviors.CursorSync({ key: 'metricCrosshairSync', sync: DashboardCursorSync.Crosshair })],
        children: [
          new SceneFlexItem({
            minHeight: MAIN_PANEL_MIN_HEIGHT,
            maxHeight: MAIN_PANEL_MAX_HEIGHT,
            body: new GmdVizPanel({
              metric,
              panelOptions: {
                height: PANEL_HEIGHT.XL,
                headerActions: isClassicHistogramMetric(metric)
                  ? ({ metric }) => [
                      new GmdVizPanelVariantSelector(),
                      new ConfigurePanelAction({ metric }),
                      new AddToDashboardAction(),
                      new BookmarkHeaderAction(),
                    ]
                  : ({ metric }) => [
                      new ConfigurePanelAction({ metric }),
                      new AddToDashboardAction(),
                      new BookmarkHeaderAction(),
                    ],
                menu: () => new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY, labelName: metric }),
              },
              queryOptions: {
                resolution: QUERY_RESOLUTION.HIGH,
              },
            }),
          }),
        ],
      }),
      selectedTab: undefined,
      actionBar: new MetricActionBar({}),
    });

    this.addActivationHandler(() => {
      this.onActivate();
    });
  }

  private async onActivate() {
    const { metric } = this.state;
    const metadata = await getTrailFor(this).getMetadataForMetric(metric);

    const [gmdVizPanel] = sceneGraph.findDescendents(this, GmdVizPanel);
    const { metricType } = gmdVizPanel.state;

    if (metadata) {
      gmdVizPanel.update({ description: getMetricDescription(metadata) }, {});
    }

    if (metricType === 'classic-histogram') {
      return;
    }

    const sub = gmdVizPanel.subscribeToState(async (newState) => {
      if (metricType !== 'native-histogram' && newState.metricType === 'native-histogram') {
        sub.unsubscribe();

        gmdVizPanel.update(
          {
            headerActions: () => [
              new GmdVizPanelVariantSelector(),
              new ConfigurePanelAction({ metric: { name: metric, type: newState.metricType } }),
              new BookmarkHeaderAction(),
            ],
          },
          {}
        );
      }
    });

    this._subs.add(sub);
  }

  public static readonly Component = ({ model }: SceneComponentProps<MetricGraphScene>) => {
    const { topView, selectedTab, actionBar } = model.useState();
    const chromeHeaderHeight = useChromeHeaderHeight();
    const trail = getTrailFor(model);
    const styles = useStyles2(getStyles, trail.state.embedded ? 0 : chromeHeaderHeight ?? 0, trail);
    const controlsContainer = useRef<HTMLDivElement>(null);

    useResizeObserver({
      ref: controlsContainer,
      onResize: () => {
        const element = controlsContainer.current;
        if (element) {
          requestAnimationFrame(() => {
            updateActionBarHeight(controlsContainer);
          });
        }
      },
    });

    return (
      <div className={styles.container}>
        <div className={cx(styles.topView, styles.nonSticky)} data-testid="top-view">
          <topView.Component model={topView} />
        </div>
        <div className={cx(styles.topView, styles.stickyTop)} id="action-bar-container" ref={controlsContainer}>
          <actionBar.Component model={actionBar} />
        </div>
        {selectedTab && (
          <div data-testid="tab-content" className={styles.tabContent}>
            <selectedTab.Component model={selectedTab} />
          </div>
        )}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, headerHeight: number, trail: DataTrail) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      flexGrow: 1,
    }),
    tabContent: css({
      height: '100%',
    }),
    topView: css({}),
    stickyTop: css({
      display: 'flex',
      flexDirection: 'row',
      background: getAppBackgroundColor(theme, trail),
      position: 'sticky',
      paddingTop: theme.spacing(1),
      zIndex: 10,
      // --app-controls-height is set dynamically by DataTrail component via ResizeObserver
      // This ensures the main graph sticks below the app-controls in embedded mode
      top: `calc(var(--app-controls-height, 0px) + ${headerHeight}px)`,
    }),
    nonSticky: css({
      display: 'flex',
      flexDirection: 'row',
    }),
  };
}

function updateActionBarHeight(controlsContainer: React.RefObject<HTMLDivElement>) {
  const actionBar = controlsContainer.current;

  if (!actionBar) {
    return;
  }

  const { height } = actionBar.getBoundingClientRect();
  document.documentElement.style.setProperty('--action-bar-height', `${height}px`);
}
