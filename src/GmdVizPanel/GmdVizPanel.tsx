import { css } from '@emotion/css';
import { type GrafanaTheme2, type ValueMapping } from '@grafana/data';
import {
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObjectState,
  type VizPanel,
  type VizPanelState,
} from '@grafana/scenes';
import { useStyles2, type VizLegendOptions } from '@grafana/ui';
import { isEqual } from 'lodash';
import React from 'react';

import { PREF_KEYS } from 'UserPreferences/pref-keys';
import { userPreferences } from 'UserPreferences/userPreferences';
import { getTrailFor } from 'utils';
import { SelectAction } from 'WingmanDataTrail/MetricVizPanel/actions/SelectAction';

import { type LabelMatcher } from './buildQueryExpression';
import { PANEL_HEIGHT } from './config/panel-heights';
import { type PanelConfigPreset } from './config/presets/types';
import { type PrometheusFunction } from './config/promql-functions';
import { QUERY_RESOLUTION } from './config/query-resolutions';
import { EventPanelTypeChanged } from './EventPanelTypeChanged';
import { buildHeatmapPanel } from './heatmap/buildHeatmapPanel';
import { isHistogramMetric } from './heatmap/isHistogramMetric';
import { buildPercentilesPanel } from './percentiles/buildPercentilesPanel';
import { buildStatPanel } from './stat/buildStatPanel';
import { buildStatushistoryPanel } from './statushistory/buildStatushistoryPanel';
import { isUpDownMetric } from './statushistory/isUpDownMetric';
import { buildTimeseriesPanel } from './timeseries/buildTimeseriesPanel';

/* Panel config */

export type PanelType = 'timeseries' | 'statushistory' | 'heatmap' | 'percentiles' | 'stat' | 'table';

export type PanelConfig = {
  type: PanelType;
  title: string;
  height: PANEL_HEIGHT;
  headerActions: (headerActionsArgs: { metric: string; panelConfig: PanelConfig }) => VizPanelState['headerActions'];
  fixedColorIndex?: number;
  description?: string;
  menu?: VizPanelState['menu'];
  legend?: Partial<VizLegendOptions>;
  mappings?: ValueMapping[];
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
  mappings?: PanelConfig['mappings'];
};

/* Query config */

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
    discardUserPrefs,
  }: {
    metric: GmdVizPanelState['metric'];
    panelOptions?: PanelOptions;
    queryOptions?: QueryOptions;
    discardUserPrefs?: boolean;
  }) {
    const histogramType = isHistogramMetric(metric) ? 'classic' : 'none';
    const preferredConfig = discardUserPrefs ? undefined : GmdVizPanel.retrievePreferredConfig(metric);

    super({
      metric,
      histogramType,
      panelConfig: {
        // we want a panel type to get a chance to render the panel as soon as possible
        // we can't determine if it's a native histogram here because it's an sync process that will be done in onActivate()
        type: panelOptions?.type || GmdVizPanel.getPanelType(metric, histogramType),
        title: metric,
        height: PANEL_HEIGHT.M,
        headerActions: ({ metric }) => [new SelectAction({ metricName: metric })],
        ...panelOptions,
        ...preferredConfig?.panelOptions,
      },
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [],
        addIgnoreUsageFilter: true,
        ...queryOptions,
        ...preferredConfig?.queryOptions,
      },
      body: undefined,
    });

    this.addActivationHandler(() => {
      this.onActivate(Boolean(panelOptions?.type));
    });
  }

  private static retrievePreferredConfig(metric: string): PanelConfigPreset | undefined {
    const userPrefs = userPreferences.getItem(PREF_KEYS.METRIC_PREFS);
    const userPrefForMetric = userPrefs && userPrefs[metric];
    return userPrefForMetric?.config;
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

    // force initialization and update if needed
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
        !isEqual(newState.panelConfig, prevState.panelConfig) ||
        !isEqual(newState.queryConfig, prevState.queryConfig)
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

      case 'stat':
        this.setState({
          body: buildStatPanel({ metric, panelConfig, queryConfig }),
        });
        return;

      default:
        throw new TypeError(`Unsupported panel type "${panelConfig.type}"!`);
    }
  }

  public update(panelOptions: PanelOptions, queryOptions: QueryOptions) {
    const { panelConfig, queryConfig } = this.state;

    this.setState({
      panelConfig: {
        ...panelConfig,
        ...panelOptions,
      },
      queryConfig: {
        ...queryConfig,
        ...queryOptions,
      },
    });
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
