import { css, cx } from '@emotion/css';
import { DashboardCursorSync, type GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import {
  behaviors,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneReactObject,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React, { useEffect } from 'react';

import { GmdVizPanel, PANEL_HEIGHT, QUERY_RESOLUTION } from 'GmdVizPanel/GmdVizPanel';
import { GmdVizPanelVariantSelector } from 'GmdVizPanel/GmdVizPanelVariantSelector';
import { getMetricDescription } from 'helpers/MetricDatasourceHelper';
import { PanelMenu } from 'Menu/PanelMenu';
import { MetricActionBar } from 'MetricActionBar';

import { type DataTrail } from './DataTrail';
import { getTrailFor } from './utils';
import { getAppBackgroundColor } from './utils/utils.styles';

const MAIN_PANEL_MIN_HEIGHT = GmdVizPanel.getPanelHeightInPixels(PANEL_HEIGHT.XL);
const MAIN_PANEL_MAX_HEIGHT = '40%';
export const TOPVIEW_KEY = 'topview';

export interface MetricGraphSceneState extends SceneObjectState {
  metric: string;
  topView: SceneFlexLayout;
  selectedTab?: SceneObject;
  actionBar: SceneObject;
}

export class MetricGraphScene extends SceneObjectBase<MetricGraphSceneState> {
  public constructor(state: { metric: MetricGraphSceneState['metric'] }) {
    super({
      metric: state.metric,
      topView: new SceneFlexLayout({
        direction: 'column',
        $behaviors: [new behaviors.CursorSync({ key: 'metricCrosshairSync', sync: DashboardCursorSync.Crosshair })],
        children: [
          // prevent height flicker when landing
          new SceneFlexItem({
            minHeight: MAIN_PANEL_MIN_HEIGHT,
            maxHeight: MAIN_PANEL_MAX_HEIGHT,
            body: new SceneReactObject({ reactNode: <div /> }),
          }),
        ],
      }),
      selectedTab: undefined,
      actionBar: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            ySizing: 'content',
            body: new MetricActionBar({}),
          }),
        ],
      }),
    });

    this.addActivationHandler(() => {
      this.onActivate();
    });
  }

  private async onActivate() {
    const { metric, topView } = this.state;
    const trail = getTrailFor(this);
    const metadata = await trail.getMetricMetadata(metric);
    const description = getMetricDescription(metadata);

    topView.setState({
      children: [
        new SceneFlexItem({
          key: TOPVIEW_KEY,
          minHeight: MAIN_PANEL_MIN_HEIGHT,
          maxHeight: MAIN_PANEL_MAX_HEIGHT,
          body: new GmdVizPanel({
            metric,
            description,
            height: PANEL_HEIGHT.XL,
            headerActions: ({ panelType }) => [new GmdVizPanelVariantSelector({ metric, panelType })],
            menu: new PanelMenu({ labelName: metric }),
            queryResolution: QUERY_RESOLUTION.HIGH,
          }),
        }),
      ],
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<MetricGraphScene>) => {
    const { topView, selectedTab, actionBar } = model.useState();
    const chromeHeaderHeight = useChromeHeaderHeight();
    const trail = getTrailFor(model);
    const styles = useStyles2(getStyles, trail.state.embedded ? 0 : chromeHeaderHeight ?? 0, trail);

    // Set CSS custom property for action bar height - always needed for search bar positioning
    useEffect(() => {
      // Update on mount
      updateActionBarHeight();

      // Use ResizeObserver to watch for height changes
      const actionBar = document.querySelector('[data-testid="action-bar"]');

      if (!actionBar) {
        return;
      }

      const resizeObserver = new ResizeObserver(updateActionBarHeight);
      resizeObserver.observe(actionBar);

      return () => {
        // Clean up
        resizeObserver.disconnect();
        document.documentElement.style.removeProperty('--action-bar-height');
      };
    }, []); // Empty dependency array - always run

    return (
      <div className={styles.container}>
        <div className={cx(styles.topView, styles.nonSticky)} data-testid="top-view">
          <topView.Component model={topView} />
        </div>
        <div className={cx(styles.topView, styles.stickyTop)} data-testid="action-bar">
          <actionBar.Component model={actionBar} />
        </div>
        {selectedTab && (
          <div data-testid="tab-content">
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

function updateActionBarHeight() {
  const actionBar = document.querySelector('[data-testid="action-bar"]');

  if (!actionBar) {
    return;
  }

  const { height } = actionBar.getBoundingClientRect();
  document.documentElement.style.setProperty('--action-bar-height', `${height}px`);
}
