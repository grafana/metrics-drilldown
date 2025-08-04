import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObjectState,
  type VizPanel,
  type VizPanelState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { getTrailFor } from 'utils';
import { SelectAction } from 'WingmanDataTrail/MetricVizPanel/actions/SelectAction';

import { type LabelMatcher } from './buildQueryExpression';
import { EventPanelTypeChanged } from './EventPanelTypeChanged';
import { buildHeatmapPanel } from './heatmap/buildHeatmapPanel';
import { isHistogramMetric } from './heatmap/isHistogramMetric';
import { buildPercentilesPanel } from './percentiles/buildPercentilesPanel';
import { buildStatushistoryPanel } from './statushistory/buildStatushistoryPanel';
import { isUpDownMetric } from './statushistory/isUpDownMetric';
import { buildTimeseriesPanel } from './timeseries/buildTimeseriesPanel';

export enum PANEL_TYPE {
  TIMESERIES = 'TIMESERIES',
  HEATMAP = 'HEATMAP',
  STATUSHISTORY = 'STATUSHISTORY',
  PERCENTILES = 'PERCENTILES',
}

export enum PANEL_HEIGHT {
  S = 'S',
  M = 'M',
  L = 'L',
  XL = 'XL',
}

export enum QUERY_RESOLUTION {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
}

type HeaderActionsOptions = {
  metric: string;
  panelType: PANEL_TYPE;
};

export interface GmdVizPanelState extends SceneObjectState {
  metric: string;
  title: string;
  matchers: LabelMatcher[];
  heightInPixels: string;
  headerActions: (headerActionsOptions: HeaderActionsOptions) => VizPanelState['headerActions'];
  queryResolution: QUERY_RESOLUTION;
  menu?: VizPanelState['menu'];
  panelType?: PANEL_TYPE;
  fixedColor?: string;
  isNativeHistogram?: boolean;
  groupBy?: string;
  description?: string;
  body?: VizPanel;
}

const DEFAULT_HEADER_ACTIONS_BUILDER: GmdVizPanelState['headerActions'] = ({ metric }) => [
  new SelectAction({ metricName: metric }),
];

export class GmdVizPanel extends SceneObjectBase<GmdVizPanelState> {
  constructor({
    metric,
    matchers,
    height,
    headerActions,
    menu,
    panelType,
    fixedColor,
    title,
    groupBy,
    description,
    queryResolution,
  }: {
    metric: GmdVizPanelState['metric'];
    matchers?: GmdVizPanelState['matchers'];
    height?: PANEL_HEIGHT;
    headerActions?: GmdVizPanelState['headerActions'];
    menu?: GmdVizPanelState['menu'];
    panelType?: PANEL_TYPE;
    fixedColor?: GmdVizPanelState['fixedColor'];
    title?: GmdVizPanelState['title'];
    groupBy?: GmdVizPanelState['groupBy'];
    description?: GmdVizPanelState['description'];
    queryResolution?: QUERY_RESOLUTION;
  }) {
    super({
      metric,
      matchers: matchers || [],
      heightInPixels: `${GmdVizPanel.getPanelHeightInPixels(height || PANEL_HEIGHT.M)}px`,
      headerActions: headerActions || DEFAULT_HEADER_ACTIONS_BUILDER,
      menu,
      panelType,
      fixedColor,
      title: title || metric,
      groupBy,
      description,
      queryResolution: queryResolution || QUERY_RESOLUTION.MEDIUM,
      isNativeHistogram: undefined,
      body: undefined,
    });

    this.addActivationHandler(() => {
      this.onActivate();
    });
  }

  private async onActivate() {
    const { metric, panelType } = this.state;

    this.subscribeToStateChanges();
    this.subscribeToEvents();

    // isNativeHistogram() depends on an async process to load metrics metadata, so it's possibile that
    // when landing on the page, the metadata is not yet loaded and the histogram metrics are not be rendered as heatmap panels.
    // But we still want to render them ASAP and update them later when the metadata has arrived.
    const trail = getTrailFor(this);
    const isNativeHistogram = trail.isNativeHistogram(metric);

    this.setState({
      panelType: panelType || this.getDefaultPanelType(isNativeHistogram),
      isNativeHistogram,
    });

    if (isNativeHistogram) {
      return;
    }

    // force initialization
    await trail.initializeHistograms();
    const newIsNativeHistogram = trail.isNativeHistogram(metric);

    if (newIsNativeHistogram) {
      this.setState({
        panelType: this.getDefaultPanelType(newIsNativeHistogram),
        isNativeHistogram: newIsNativeHistogram,
      });
    }
  }

  private getDefaultPanelType(isNativeHistogram: boolean): PANEL_TYPE {
    const { metric } = this.state;

    if (isUpDownMetric(metric)) {
      return PANEL_TYPE.STATUSHISTORY;
    }

    if (isNativeHistogram || isHistogramMetric(metric)) {
      return PANEL_TYPE.HEATMAP;
    }

    return PANEL_TYPE.TIMESERIES;
  }

  public static getPanelHeightInPixels(h: PANEL_HEIGHT): number {
    switch (h) {
      case PANEL_HEIGHT.S:
        return 160;
      case PANEL_HEIGHT.L:
        return 260;
      case PANEL_HEIGHT.XL:
        return 280;
      case PANEL_HEIGHT.M:
      default:
        return 220;
    }
  }

  private subscribeToStateChanges() {
    this.subscribeToState((newState, prevState) => {
      if (newState.isNativeHistogram === undefined || newState.panelType === undefined) {
        return;
      }

      if (newState.isNativeHistogram !== prevState.isNativeHistogram || newState.panelType !== prevState.panelType) {
        this.updateBody();
      }
    });
  }

  private subscribeToEvents() {
    this.subscribeToEvent(EventPanelTypeChanged, (event) => {
      // the sub in subscribeToStateChanges() above will handle updating the body
      this.setState({ panelType: event.payload.panelType });
    });
  }

  private updateBody() {
    const {
      panelType,
      title,
      description,
      metric,
      matchers,
      headerActions,
      menu,
      queryResolution,
      fixedColor,
      groupBy,
      isNativeHistogram,
    } = this.state;

    switch (panelType) {
      case PANEL_TYPE.TIMESERIES:
        this.setState({
          body: buildTimeseriesPanel({
            title,
            description,
            metric,
            matchers,
            headerActions,
            menu,
            queryResolution,
            // custom
            fixedColor,
            groupBy,
          }),
        });
        return;

      case PANEL_TYPE.HEATMAP:
        this.setState({
          body: buildHeatmapPanel({
            title,
            description,
            metric,
            matchers,
            headerActions,
            menu,
            queryResolution,
            // custom
            isNativeHistogram,
          }),
        });
        return;

      case PANEL_TYPE.PERCENTILES:
        this.setState({
          body: buildPercentilesPanel({
            title,
            description,
            metric,
            matchers,
            headerActions,
            menu,
            queryResolution,
            // custom
            isNativeHistogram,
          }),
        });
        return;

      case PANEL_TYPE.STATUSHISTORY:
        this.setState({
          body: buildStatushistoryPanel({
            title,
            description,
            metric,
            matchers,
            headerActions,
            menu,
            queryResolution,
          }),
        });
        return;

      default:
        throw new TypeError(`Unsupported panel type "${panelType}"!`);
    }
  }

  public changePanelType(newPanelType: PANEL_TYPE) {
    this.setState({ panelType: newPanelType });
  }

  public static readonly Component = ({ model }: SceneComponentProps<GmdVizPanel>) => {
    const { body, heightInPixels } = model.useState();
    const styles = useStyles2(getStyles, heightInPixels);

    return (
      <div className={styles.container} data-testid="gmd-vizpanel">
        {body && <body.Component model={body} />}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, heightInPixels: string) {
  return {
    container: css`
      width: 100%;
      height: ${heightInPixels};
    `,
  };
}
