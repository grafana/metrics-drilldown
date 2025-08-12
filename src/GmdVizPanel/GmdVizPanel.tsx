import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObjectState,
  type VizPanel,
  type VizPanelState,
} from '@grafana/scenes';
import { useStyles2, type VizLegendOptions } from '@grafana/ui';
import React from 'react';

import { getTrailFor } from 'utils';
import { SelectAction } from 'WingmanDataTrail/MetricVizPanel/actions/SelectAction';

import { type LabelMatcher } from './buildQueryExpression';
import {
  DEFAULT_HISTOGRAMS_PRESETS,
  DEFAULT_TIMESERIES_PRESETS,
  type PanelConfigPreset,
} from './config/config-presets';
import { PANEL_HEIGHT } from './config/panel-heights';
import { QUERY_RESOLUTION } from './config/query-resolutions';
import { EventPanelTypeChanged } from './EventPanelTypeChanged';
import { buildHeatmapPanel } from './heatmap/buildHeatmapPanel';
import { isHistogramMetric } from './heatmap/isHistogramMetric';
import { buildPercentilesPanel } from './percentiles/buildPercentilesPanel';
import { buildStatushistoryPanel } from './statushistory/buildStatushistoryPanel';
import { isUpDownMetric } from './statushistory/isUpDownMetric';
import { buildTimeseriesPanel } from './timeseries/buildTimeseriesPanel';

/* Panel config */

export type PanelType = 'timeseries' | 'statushistory' | 'heatmap' | 'percentiles' | 'stat' | 'table';

type HeaderActionsArgs = {
  metric: string;
  panelConfig: PanelConfig;
};

export type PanelConfig = {
  type: PanelType;
  title: string;
  height: PANEL_HEIGHT;
  headerActions: (headerActionsArgs: HeaderActionsArgs) => VizPanelState['headerActions'];
  fixedColorIndex?: number;
  description?: string;
  menu?: VizPanelState['menu'];
  legend?: Partial<VizLegendOptions>;
};

export type PanelOptions = {
  type?: PanelConfig['type'];
  height?: PanelConfig['height'];
  fixedColorIndex?: PanelConfig['fixedColorIndex'];
  title?: PanelConfig['title'];
  description?: PanelConfig['description'];
  headerActions?: PanelConfig['headerActions'];
  menu?: PanelConfig['menu'];
  legend?: PanelConfig['legend'];
};

/* Query config */

export type PrometheusFunction =
  // timeseries
  | 'avg'
  | 'sum'
  | 'stddev'
  | 'quantile'
  | 'min'
  | 'max'
  // percentiles & heatmaps
  | 'histogram_quantile'
  // age
  | 'time-avg'
  | 'avg(time-metric)';

export type QueryDefs = Array<{
  fn: PrometheusFunction;
  params?: Record<string, any>;
}>;

export type QueryConfig = {
  resolution: QUERY_RESOLUTION;
  labelMatchers: LabelMatcher[];
  addIgnoreUsageFilter: boolean;
  groupBy?: string;
  queries?: QueryDefs;
};

export type QueryOptions = {
  resolution?: QueryConfig['resolution'];
  labelMatchers?: QueryConfig['labelMatchers'];
  groupBy?: string;
  queries?: Array<{
    fn: PrometheusFunction;
    params?: Record<string, any>;
  }>;
};

/* GmdVizPanelState */

export type HistogramType = 'native' | 'classic' | 'none';

export interface GmdVizPanelState extends SceneObjectState {
  metric: string;
  histogramType: HistogramType;
  panelConfig: PanelConfig;
  queryConfig: QueryConfig;
  body?: VizPanel;
}

export class GmdVizPanel extends SceneObjectBase<GmdVizPanelState> {
  constructor({
    metric,
    panelOptions,
    queryOptions,
  }: {
    metric: GmdVizPanelState['metric'];
    panelOptions?: PanelOptions;
    queryOptions?: QueryOptions;
  }) {
    const histogramType = isHistogramMetric(metric) ? 'classic' : 'none';

    super({
      metric,
      histogramType,
      panelConfig: {
        // we want a panel type to get a chance to render the panel as soon as possible
        // this is why we assume that it's not a native histogram, which seems reasonable statistically speaking
        // see onActivate() for more
        type: panelOptions?.type || GmdVizPanel.getPanelType(metric, histogramType),
        title: metric,
        height: PANEL_HEIGHT.M,
        headerActions: ({ metric }) => [new SelectAction({ metricName: metric })],
        ...panelOptions,
      },
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [],
        addIgnoreUsageFilter: true,
        ...queryOptions,
      },
      body: undefined,
    });

    this.addActivationHandler(() => {
      this.onActivate(Boolean(panelOptions?.type));
    });
  }

  private async onActivate(discardPanelTypeUpdates: boolean) {
    const { metric, panelConfig } = this.state;

    this.updateBody();

    this.subscribeToStateChanges();
    this.subscribeToEvents();

    // isNativeHistogram() depends on an async process to load metrics metadata, so it's possible that
    // when landing on the page, the metadata is not yet loaded and the histogram metrics are not be rendered as heatmap panels.
    // But we still want to render them ASAP and update them later when the metadata has arrived.
    const trail = getTrailFor(this);

    if (trail.isNativeHistogram(metric)) {
      this.setState({
        panelConfig: discardPanelTypeUpdates
          ? panelConfig
          : { ...panelConfig, type: GmdVizPanel.getPanelType(metric, 'native') },
        histogramType: 'native',
      });
      return;
    }

    // force initialization
    await trail.initializeHistograms();

    if (trail.isNativeHistogram(metric)) {
      this.setState({
        panelConfig: discardPanelTypeUpdates
          ? panelConfig
          : { ...panelConfig, type: GmdVizPanel.getPanelType(metric, 'native') },
        histogramType: 'native',
      });
    }
  }

  private static getPanelType(metric: string, histogramType: HistogramType): PanelType {
    if (isUpDownMetric(metric)) {
      return 'statushistory';
    }
    if (histogramType === 'classic' || histogramType === 'native') {
      return 'heatmap';
    }
    return 'timeseries';
  }

  private subscribeToStateChanges() {
    this.subscribeToState((newState, prevState) => {
      if (
        newState.histogramType !== prevState.histogramType ||
        newState.panelConfig.type !== prevState.panelConfig.type
      ) {
        this.updateBody();
      }
    });
  }

  private subscribeToEvents() {
    this.subscribeToEvent(EventPanelTypeChanged, (event) => {
      this.setState({
        panelConfig: {
          ...this.state.panelConfig,
          type: event.payload.panelType,
        },
      });
    });
  }

  private updateBody() {
    const { metric, panelConfig, queryConfig, histogramType } = this.state;

    switch (panelConfig.type) {
      case 'timeseries':
        this.setState({
          body: buildTimeseriesPanel({ metric, panelConfig, queryConfig }),
        });
        return;

      case 'heatmap':
        this.setState({
          body: buildHeatmapPanel({ metric, histogramType, panelConfig, queryConfig }),
        });
        return;

      case 'percentiles':
        this.setState({
          body: buildPercentilesPanel({
            metric,
            histogramType,
            panelConfig,
            queryConfig,
          }),
        });
        return;

      case 'statushistory':
        this.setState({
          body: buildStatushistoryPanel({ metric, panelConfig, queryConfig }),
        });
        return;

      default:
        throw new TypeError(`Unsupported panel type "${panelConfig.type}"!`);
    }
  }

  public static getConfigPresetsForMetric(metric: string, isNativeHistogram: boolean): PanelConfigPreset[] {
    if (isUpDownMetric(metric)) {
      return [];
    }

    if (isNativeHistogram || isHistogramMetric(metric)) {
      return Object.values(DEFAULT_HISTOGRAMS_PRESETS);
    }

    return Object.values(DEFAULT_TIMESERIES_PRESETS);
  }

  public static readonly Component = ({ model }: SceneComponentProps<GmdVizPanel>) => {
    const { body, panelConfig } = model.useState();
    const styles = useStyles2(getStyles, panelConfig.height);

    return (
      <div className={styles.container} data-testid="gmd-vizpanel">
        {body && <body.Component model={body} />}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, height: PANEL_HEIGHT) {
  return {
    container: css`
      width: 100%;
      height: ${height}px;
    `,
  };
}
