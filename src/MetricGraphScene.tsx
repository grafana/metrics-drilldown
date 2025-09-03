import { css, cx } from '@emotion/css';
import { DashboardCursorSync, type GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import {
  behaviors,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneReactObject,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { ConfigurePanelAction } from 'GmdVizPanel/components/ConfigurePanelAction';
import { GmdVizPanelVariantSelector } from 'GmdVizPanel/components/GmdVizPanelVariantSelector';
import { PANEL_HEIGHT } from 'GmdVizPanel/config/panel-heights';
import { QUERY_RESOLUTION } from 'GmdVizPanel/config/query-resolutions';
import { GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';
import { getPanelTypeForMetric } from 'GmdVizPanel/matchers/getPanelTypeForMetric';
import { isHistogramMetric } from 'GmdVizPanel/matchers/isHistogramMetric';
import { addCardinalityInfo } from 'GmdVizPanel/types/timeseries/behaviors/addCardinalityInfo';
import { addRefId } from 'GmdVizPanel/types/timeseries/transformations/addRefId';
import { addUnspecifiedLabel } from 'GmdVizPanel/types/timeseries/transformations/addUnspecifiedLabel';
import { getMetricDescription } from 'helpers/MetricDatasourceHelper';
import { PanelMenu } from 'Menu/PanelMenu';
import { MetricActionBar } from 'MetricActionBar';
import { ALL_VARIABLE_VALUE } from 'services/variables';
import { VAR_GROUP_BY } from 'shared';

import { DataTrail } from './DataTrail';
import { getTrailFor, getTrailSettings } from './utils';
import { getAppBackgroundColor } from './utils/utils.styles';

const MAIN_PANEL_MIN_HEIGHT = PANEL_HEIGHT.XL;
const MAIN_PANEL_MAX_HEIGHT = '40%';
export const TOPVIEW_PANEL_KEY = 'topview-panel';

interface MetricGraphSceneState extends SceneObjectState {
  metric: string;
  topView: SceneFlexLayout;
  selectedTab?: SceneObject;
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
          new SceneFlexItem({
            ySizing: 'content',
            body: new MetricActionBar({}),
          }),
        ],
      }),
      selectedTab: undefined,
    });

    this.addActivationHandler(() => {
      this.onActivate();
    });
  }

  private async onActivate() {
    const { metric, topView } = this.state;
    const trail = getTrailFor(this);
    const metadata = await trail.getMetadataForMetric(metric);
    const description = getMetricDescription(metadata);
    const isHistogram = isHistogramMetric(metric) || (await trail.isNativeHistogram(metric));

    // We get the "group by" parameter directly for the URL... This is not ideal but, given the structure of MetricScene,
    // it's possible that the GroupByVariable is not rendered. This happens for instance when the "Related metrics" tab is selected.
    const { urlNamespace } = sceneGraph.getAncestor(this, DataTrail).state;
    const groupByParamName = urlNamespace ? `${urlNamespace}var-${VAR_GROUP_BY}` : `var-${VAR_GROUP_BY}`; // support namespace if the app is embedded (in Asserts for example)
    const groupByFromUrl = new URL(window.location.href).searchParams.get(groupByParamName);
    const groupBy = groupByFromUrl !== ALL_VARIABLE_VALUE ? (groupByFromUrl as string) : undefined;

    const queryConfig = await this.getQueryConfig(groupBy);

    topView.setState({
      children: [
        new SceneFlexItem({
          minHeight: MAIN_PANEL_MIN_HEIGHT,
          maxHeight: MAIN_PANEL_MAX_HEIGHT,
          body: new GmdVizPanel({
            key: TOPVIEW_PANEL_KEY,
            metric,
            panelOptions: {
              title: groupBy ? `${metric}, grouped by ${groupBy}` : metric,
              height: PANEL_HEIGHT.XL,
              description,
              headerActions: isHistogram
                ? () => [new GmdVizPanelVariantSelector({ metric }), new ConfigurePanelAction({ metric })]
                : () => [new ConfigurePanelAction({ metric })],
              menu: () => new PanelMenu({ labelName: metric }),
              behaviors: groupBy ? [addCardinalityInfo({ description: null })] : [],
            },
            queryOptions: queryConfig || {
              resolution: QUERY_RESOLUTION.HIGH,
            },
          }),
        }),
        new SceneFlexItem({
          ySizing: 'content',
          body: new MetricActionBar({}),
        }),
      ],
    });
  }

  private async getQueryConfig(groupBy?: string) {
    // only timeseries panels support queryConfig.groupBy
    const panelType = await getPanelTypeForMetric(this, this.state.metric);
    if (panelType !== 'timeseries') {
      return null;
    }

    return {
      resolution: QUERY_RESOLUTION.HIGH,
      groupBy,
      // when grouped by, we don't slice the series received (which happens by default in buildTimeseriesPanel.ts)
      transformations: groupBy ? [addUnspecifiedLabel(groupBy), addRefId] : undefined,
    };
  }

  public async toggleGroupBy(label: string) {
    const groupBy = label !== ALL_VARIABLE_VALUE ? label : undefined;
    const newQueryConfig = await this.getQueryConfig(groupBy);
    if (!newQueryConfig) {
      return;
    }

    try {
      const topViewPanel = sceneGraph.findByKeyAndType(this, TOPVIEW_PANEL_KEY, GmdVizPanel);

      topViewPanel.setState({
        ...topViewPanel.state,
        panelConfig: {
          ...topViewPanel.state.panelConfig,
          behaviors: groupBy ? [addCardinalityInfo({ description: null })] : [],
        },
        queryConfig: {
          ...topViewPanel.state.queryConfig,
          ...newQueryConfig,
        },
      });
    } catch {}
  }

  public static readonly Component = ({ model }: SceneComponentProps<MetricGraphScene>) => {
    const { topView, selectedTab } = model.useState();
    const { stickyMainGraph } = getTrailSettings(model).useState();
    const chromeHeaderHeight = useChromeHeaderHeight();
    const trail = getTrailFor(model);
    const styles = useStyles2(getStyles, trail.state.embedded ? 0 : chromeHeaderHeight ?? 0, trail);

    return (
      <div className={styles.container}>
        <div
          className={stickyMainGraph ? cx(styles.topView, styles.sticky) : cx(styles.topView, styles.nonSticky)}
          data-testid="top-view"
        >
          <topView.Component model={topView} />
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
    sticky: css({
      display: 'flex',
      flexDirection: 'row',
      background: getAppBackgroundColor(theme, trail),
      position: 'sticky',
      paddingTop: theme.spacing(1),
      marginTop: `-${theme.spacing(1)}`,
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
