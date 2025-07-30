import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState, type VizPanel } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { getTrailFor } from 'utils';

import { getPanelBuilderOptions, type LabelMatcher } from './getPanelBuilderOptions';
import { buildHeatmapPanel } from './heatmap/buildHeatmapPanel';
import { buildStatushistoryPanel } from './statushistory/buildStatushistoryPanel';
import { buildTimeseriesPanel } from './timeseries/buildTimeseriesPanel';

export type PanelHeight = 's' | 'm' | 'l' | 'xl';

interface GmdVizPanelState extends SceneObjectState {
  metric: string;
  matchers: LabelMatcher[];
  heightInPixels: string;
  fixedColor?: string;
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
      body: undefined,
    });

    this.addActivationHandler(() => {
      this.onActivate();
    });
  }

  private async onActivate() {
    const { metric } = this.state;
    const trail = getTrailFor(this);
    const isNativeHistogram = trail.isNativeHistogram(metric);

    // isNativeHistogram() depends on an async process to load metrics metadata, so it's possibile that
    // when landing on the page, the metadata is not yet loaded and the histogram metrics are not be rendered as heatmap panels.
    // We still want to render them ASAP and update them later when the metadata has arrived.
    this.setState({
      body: this.buildBody(isNativeHistogram),
    });

    if (isNativeHistogram) {
      return;
    }

    await trail.getMetricMetadata(metric);
    const newIsNativeHistogram = trail.isNativeHistogram(metric);

    if (isNativeHistogram !== newIsNativeHistogram) {
      this.setState({
        body: this.buildBody(newIsNativeHistogram),
      });
    }
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

  private buildBody(isNativeHistogram: boolean) {
    const { metric, matchers, fixedColor } = this.state;
    const panelBuilderOptions = getPanelBuilderOptions({ metric, matchers, isNativeHistogram, fixedColor });

    switch (panelBuilderOptions.default.type) {
      case 'timeseries':
        return buildTimeseriesPanel(panelBuilderOptions);

      case 'heatmap':
        return buildHeatmapPanel(panelBuilderOptions);

      case 'statushistory':
        return buildStatushistoryPanel(panelBuilderOptions);

      default:
        throw new TypeError(`Unsupported panel type "${panelBuilderOptions.default.type}"!`);
    }
  }

  public static readonly Component = ({ model }: SceneComponentProps<GmdVizPanel>) => {
    const { body, heightInPixels /*, isNativeHistogram*/ } = model.useState();
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
