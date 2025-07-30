import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState, type VizPanel } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { getTrailFor } from 'utils';

import { type LabelMatcher } from './buildQueryExpression';
import { buildHeatmapPanel } from './heatmap/buildHeatmapPanel';
import { isHistogramMetric } from './heatmap/isHistogramMetric';
import { buildStatushistoryPanel } from './statushistory/buildStatushistoryPanel';
import { isUpDownMetric } from './statushistory/isUpDownMetric';
import { buildTimeseriesPanel } from './timeseries/buildTimeseriesPanel';

type PanelType = 'timeseries' | 'heatmap' | 'statushistory';

export type PanelHeight = 's' | 'm' | 'l' | 'xl';

interface GmdVizPanelState extends SceneObjectState {
  metric: string;
  matchers: LabelMatcher[];
  heightInPixels: string;
  fixedColor?: string;
  isNativeHistogram?: boolean;
  panelType?: PanelType;
  body?: VizPanel;
}

export class GmdVizPanel extends SceneObjectBase<GmdVizPanelState> {
  constructor({
    metric,
    matchers,
    height,
    fixedColor,
  }: {
    metric: GmdVizPanelState['metric'];
    matchers?: GmdVizPanelState['matchers'];
    height?: PanelHeight;
    fixedColor?: GmdVizPanelState['fixedColor'];
  }) {
    super({
      key: 'GmdVizPanel',
      metric,
      matchers: matchers || [],
      heightInPixels: `${GmdVizPanel.getPanelHeightInPixels(height || 'm')}px`,
      fixedColor,
      isNativeHistogram: undefined,
      panelType: undefined,
      body: undefined,
    });

    this.addActivationHandler(() => {
      this.onActivate();
    });
  }

  private static getPanelHeightInPixels(h: PanelHeight): number {
    switch (h) {
      case 's':
        return 160;
      case 'l':
        return 260;
      case 'xl':
        return 280;
      case 'm':
      default:
        return 220;
    }
  }

  private async onActivate() {
    const { metric } = this.state;

    this.subscribeToStateChanges();

    // isNativeHistogram() depends on an async process to load metrics metadata, so it's possibile that
    // when landing on the page, the metadata is not yet loaded and the histogram metrics are not be rendered as heatmap panels.
    // But we still want to render them ASAP and update them later when the metadata has arrived.
    const trail = getTrailFor(this);
    const isNativeHistogram = trail.isNativeHistogram(metric);

    this.setState({
      panelType: this.getDefaultPanelType(isNativeHistogram),
      isNativeHistogram,
    });

    if (isNativeHistogram) {
      return;
    }

    // ensures that the metrics metadata is loaded and that native histograms can be determined
    await trail.getMetricMetadata(metric);
    const newIsNativeHistogram = trail.isNativeHistogram(metric);

    if (newIsNativeHistogram !== isNativeHistogram) {
      this.setState({
        panelType: this.getDefaultPanelType(newIsNativeHistogram),
        isNativeHistogram: newIsNativeHistogram,
      });
    }
  }

  private getDefaultPanelType(isNativeHistogram: boolean): PanelType {
    const { metric } = this.state;

    if (isUpDownMetric(metric)) {
      return 'statushistory';
    }

    if (isNativeHistogram || isHistogramMetric(metric)) {
      return 'heatmap';
    }

    return 'timeseries';
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

  private updateBody() {
    const { panelType, metric, matchers, fixedColor, isNativeHistogram } = this.state;

    switch (panelType) {
      case 'timeseries':
        this.setState({
          body: buildTimeseriesPanel({ metric, matchers, fixedColor: fixedColor as string }),
        });
        return;

      case 'heatmap':
        this.setState({
          body: buildHeatmapPanel({ metric, matchers, isNativeHistogram: isNativeHistogram as boolean }),
        });
        return;

      case 'statushistory':
        this.setState({
          body: buildStatushistoryPanel({ metric, matchers }),
        });
        return;

      default:
        throw new TypeError(`Unsupported panel type "${panelType}"!`);
    }
  }

  public changePanelType(newPanelType: PanelType) {
    this.setState({ panelType: newPanelType });
  }

  public static readonly Component = ({ model }: SceneComponentProps<GmdVizPanel>) => {
    const { body, heightInPixels } = model.useState();
    const styles = useStyles2(getStyles, heightInPixels);

    return <div className={styles.container}>{body && <body.Component model={body} />}</div>;
  };
}

function getStyles(theme: GrafanaTheme2, heightInPixels: string) {
  return {
    container: css`
      height: ${heightInPixels};
    `,
  };
}
