import { css } from '@emotion/css';
import { DashboardCursorSync, type GrafanaTheme2 } from '@grafana/data';
import { locationService, useChromeHeaderHeight } from '@grafana/runtime';
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
import { OpenAssistant } from 'shared/GmdVizPanel/components/OpenAssistant';
import { PANEL_HEIGHT } from 'shared/GmdVizPanel/config/panel-heights';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { isClassicHistogramMetric } from 'shared/GmdVizPanel/matchers/isClassicHistogramMetric';

import { MetricActionBar } from './MetricActionBar';
import { PanelMenu } from './PanelMenu/PanelMenu';
import { buildMiniBreakdownNavigationUrl } from '../exposedComponents/MiniBreakdown/buildNavigationUrl';
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
                      new OpenAssistant(),
                      new AddToDashboardAction(),
                      new BookmarkHeaderAction(),
                    ]
                  : ({ metric }) => [
                      new ConfigurePanelAction({ metric }),
                      new OpenAssistant(),
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
    const trail = getTrailFor(this);

    // Hide header actions and menu in embeddedMini mode, reduce height, add click navigation
    if (trail.state.embeddedMini) {
      const [flexItem] = sceneGraph.findDescendents(this, SceneFlexItem);
      flexItem.setState({ minHeight: PANEL_HEIGHT.S, maxHeight: PANEL_HEIGHT.S });

      const [gmdVizPanel] = sceneGraph.findDescendents(this, GmdVizPanel);
      gmdVizPanel.update({
        headerActions: () => [],
        menu: undefined,
        height: PANEL_HEIGHT.S,
      }, {});

      // Build navigation URL from trail state
      const timeRange = sceneGraph.getTimeRange(trail);
      const url = buildMiniBreakdownNavigationUrl({
        metric: trail.state.metric!,
        labels: (trail.state.initialFilters || []).map((f) => ({
          label: f.key,
          op: f.operator,
          value: f.value,
        })),
        dataSource: trail.state.initialDS!,
        from: String(timeRange.state.from),
        to: String(timeRange.state.to),
      });

      gmdVizPanel.setState({
        onClick: () => locationService.push(url),
        clickTitle: `Open Metrics Drilldown for ${metric}`,
      });

      return; // Skip the rest of the setup for embeddedMini
    }

    const metadata = await trail.getMetadataForMetric(metric);

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
              new OpenAssistant(),
              new AddToDashboardAction(),
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
    const { embeddedMini } = trail.state;
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
        <div className={styles.nonSticky} data-testid="top-view">
          <topView.Component model={topView} />
        </div>
        {!embeddedMini && (
          <div className={styles.stickyTop} id="action-bar-container" ref={controlsContainer}>
            <actionBar.Component model={actionBar} />
          </div>
        )}
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
