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
import React, { useRef } from 'react';

import { getMetricDescription } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { AddToDashboardAction } from 'shared/GmdVizPanel/components/AddToDashboardAction';
import { BookmarkHeaderAction } from 'shared/GmdVizPanel/components/BookmarkHeaderAction';
import { ConfigurePanelAction } from 'shared/GmdVizPanel/components/ConfigurePanelAction';
import { CreateAlertAction } from 'shared/GmdVizPanel/components/CreateAlertAction';
import { ExploreAttributesAction } from 'shared/GmdVizPanel/components/ExploreAttributesAction';
import { GmdVizPanelVariantSelector } from 'shared/GmdVizPanel/components/GmdVizPanelVariantSelector';
import { OpenAssistant } from 'shared/GmdVizPanel/components/OpenAssistant';
import { PANEL_HEIGHT } from 'shared/GmdVizPanel/config/panel-heights';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { isClassicHistogramMetric } from 'shared/GmdVizPanel/matchers/isClassicHistogramMetric';
import { type KgMetricType } from 'shared/GmdVizPanel/matchers/mapKgMetricType';
import { useResizeObserver } from 'shared/hooks/useResizeObserver';
import { getAppBackgroundColor } from 'shared/utils/utils.styles';

import { MetricActionBar } from './MetricActionBar';
import { PanelMenu } from './PanelMenu/PanelMenu';
import { buildMiniBreakdownNavigationUrl } from '../exposedComponents/MiniBreakdown/buildNavigationUrl';
import { getTrailFor } from '../shared/utils/utils';

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
  public constructor({
    metric,
    customRateInterval,
    customFunction,
    kgMetricType,
    binaryQuery,
  }: {
    metric: MetricGraphSceneState['metric'];
    customRateInterval?: string;
    customFunction?: string;
    kgMetricType?: KgMetricType;
    binaryQuery?: string;
  }) {
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
                // For a binary (ratio) insight, title the panel with the actual query, not the anchor
                // metric name. Omitted for normal metrics so the default `title: metric` stands.
                ...(binaryQuery ? { title: binaryQuery } : {}),
                titleItems: () => [new ExploreAttributesAction()],
                headerActions: isClassicHistogramMetric(metric)
                  ? ({ metric }) => [
                      new GmdVizPanelVariantSelector(),
                      new ConfigurePanelAction({ metric }),
                      new OpenAssistant(),
                      new AddToDashboardAction(),
                      new CreateAlertAction(),
                      new BookmarkHeaderAction(),
                    ]
                  : ({ metric }) => [
                      new ConfigurePanelAction({ metric }),
                      new OpenAssistant(),
                      new AddToDashboardAction(),
                      new CreateAlertAction(),
                      new BookmarkHeaderAction(),
                    ],
                menu: () => new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY, labelName: metric }),
              },
              queryOptions: {
                resolution: QUERY_RESOLUTION.HIGH,
                customRateInterval,
                customFunction,
                kgMetricType,
                // For a KG binary (ratio) insight, render the full binary expression in the main graph
                // instead of the first-leaf metric selector. Undefined for normal metrics.
                binaryExpr: binaryQuery,
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

    // Hide header actions, menu, and title items in embeddedMini mode, reduce height, add click
    // navigation. titleItems must be cleared here too: it's set unconditionally at construction
    // (titleItems: () => [new ExploreAttributesAction()]), and without clearing it, an embedded mini
    // panel for a histogram metric would still show the button, which opens a viewport-fixed sidebar
    // on top of whatever page is embedding this panel, not something an embeddedMini preview should do.
    if (trail.state.embeddedMini) {
      const [flexItem] = sceneGraph.findDescendents(this, SceneFlexItem);
      flexItem.setState({ minHeight: PANEL_HEIGHT.S, maxHeight: PANEL_HEIGHT.S });

      const [gmdVizPanel] = sceneGraph.findDescendents(this, GmdVizPanel);
      gmdVizPanel.update(
        {
          headerActions: () => [],
          menu: undefined,
          height: PANEL_HEIGHT.S,
          titleItems: () => [],
        },
        {}
      );

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

    const [gmdVizPanel] = sceneGraph.findDescendents(this, GmdVizPanel);
    const { metricType } = gmdVizPanel.state;

    const entry = trail.state.sourceMetrics?.find((s) => s.metricName === metric);
    if (!entry?.metricType) {
      const metadata = await trail.getMetadataForMetric(metric);
      if (metadata) {
        gmdVizPanel.update({ description: getMetricDescription(metadata) }, {});
      }
    }

    if (metricType === 'classic-histogram') {
      return;
    }

    const sub = gmdVizPanel.subscribeToState(async (newState) => {
      if (metricType !== 'native-histogram' && newState.metricType === 'native-histogram') {
        sub.unsubscribe();

        gmdVizPanel.update(
          {
            titleItems: () => [new ExploreAttributesAction()],
            headerActions: () => [
              new GmdVizPanelVariantSelector(),
              new ConfigurePanelAction({ metric: { name: metric, type: newState.metricType } }),
              new OpenAssistant(),
              new AddToDashboardAction(),
              new CreateAlertAction(),
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
    const styles = useStyles2(getStyles, trail.state.embedded ? 0 : (chromeHeaderHeight ?? 0));
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

function getStyles(theme: GrafanaTheme2, headerHeight: number) {
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
      backgroundColor: getAppBackgroundColor(theme),
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

function updateActionBarHeight(controlsContainer: React.RefObject<HTMLDivElement | null>) {
  const actionBar = controlsContainer.current;

  if (!actionBar) {
    return;
  }

  const { height } = actionBar.getBoundingClientRect();
  document.documentElement.style.setProperty('--action-bar-height', `${height}px`);
}
