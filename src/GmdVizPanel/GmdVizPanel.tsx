import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState, type VizPanel } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { getTrailFor } from 'utils';

import { getPanelBuilderOptions, type LabelMatcher } from './getPanelBuilderOptions';
import { getPanelHeightInPixels, type PanelHeight } from './getPanelHeightInPixels';
import { buildHeatmapPanel } from './heatmap/buildHeatmapPanel';
import { buildStatushistoryPanel } from './statushistory/buildStatushistoryPanel';
import { buildTimeseriesPanel } from './timeseries/buildTimeseriesPanel';

interface GmdVizPanelState extends SceneObjectState {
  metric: string;
  matchers: LabelMatcher[];
  heightInPixels: string;
  isNativeHistogram: boolean;
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
      heightInPixels: `${getPanelHeightInPixels(height || 'm')}px`,
      isNativeHistogram: false,
      fixedColor,
      body: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const { metric } = this.state;

    this.setState({
      // FIXME: isNativeHistogram() depends on an async process to load metrics metadata, so...
      // ...often times, when landing on the page, the metadata is not yet loaded and the histogram metrics will not be rendered as heatmap panels
      // to improve this, should we subscribe to MetricDatasourceHelper changes in DataTrail?
      isNativeHistogram: getTrailFor(this).isNativeHistogram(metric),
    });

    this.setState({
      body: this.buildBody(),
    });
  }

  private buildBody() {
    const { metric, matchers, fixedColor, isNativeHistogram } = this.state;
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

    return (
      // <div className={cx(styles.container, isNativeHistogram && styles.nativeHistogram)}>
      <div className={styles.container}>{body && <body.Component model={body} />}</div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, heightInPixels: string) {
  return {
    container: css`
      height: ${heightInPixels};
    `,
    // nativeHistogram: getNativeHistogramStyles(theme),
  };
}

// const getNativeHistogramStyles = (theme: GrafanaTheme2) => {
//   const badgeWidth = 116;

//   return css({
//     '[class$="-panel-header"]': {
//       position: 'relative',
//       paddingLeft: `${badgeWidth + 4}px`,
//     },
//     '[class$="-panel-title"]::before': {
//       content: '"Native Histogram"',
//       fontSize: '12px',
//       color: 'rgb(158, 193, 247)',
//       position: 'absolute',
//       left: '8px',
//       top: '7px',
//       display: 'inline-flex',
//       alignItems: 'center',
//       justifyContent: 'center',
//       width: `${badgeWidth}px`,
//       height: '22px',
//       padding: 0,
//       border: `1px solid ${theme.colors.info.text}`,
//       borderRadius: theme.shape.radius.pill,
//       background: theme.colors.info.transparent,
//       cursor: 'auto',
//     },
//   });
// };
