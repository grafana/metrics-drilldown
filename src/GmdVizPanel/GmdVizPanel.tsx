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

import { getTrailFor } from 'utils';

import { type LabelMatcher } from './buildQueryExpression';
import { EventPanelTypeChanged } from './components/EventPanelTypeChanged';
import { SelectAction } from './components/SelectAction';
import { getPreferredConfigForMetric } from './config/getPreferredConfigForMetric';
import { PANEL_HEIGHT } from './config/panel-heights';
import { type PrometheusFunction } from './config/promql-functions';
import { QUERY_RESOLUTION } from './config/query-resolutions';
import { isHistogramMetric } from './matchers/isHistogramMetric';
import { isStatusUpDownMetric } from './matchers/isStatusUpDownMetric';
import { type PanelType } from './types/available-panel-types';
import { buildHeatmapPanel } from './types/heatmap/buildHeatmapPanel';
import { buildPercentilesPanel } from './types/percentiles/buildPercentilesPanel';
import { buildStatPanel } from './types/stat/buildStatPanel';
import { buildStatushistoryPanel } from './types/statushistory/buildStatushistoryPanel';
import { buildTimeseriesPanel } from './types/timeseries/buildTimeseriesPanel';

/* Panel config */

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
  queries?: QueryDefs;
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
    key,
    metric,
    panelOptions,
    queryOptions,
    discardUserPrefs,
  }: {
    key?: string;
    metric: GmdVizPanelState['metric'];
    panelOptions?: PanelOptions;
    queryOptions?: QueryOptions;
    discardUserPrefs?: boolean;
  }) {
    const histogramType = isHistogramMetric(metric) ? 'classic' : 'none';
    const prefConfig = discardUserPrefs ? undefined : getPreferredConfigForMetric(metric);

    super({
      key,
      metric,
      histogramType,
      panelConfig: {
        // we want a panel type to get a chance to render the panel as soon as possible
        // we can't determine if it's a native histogram here because it's an async process that will be done in onActivate()
        type: panelOptions?.type || GmdVizPanel.getDefaultPanelTypeForMetric(metric, histogramType),
        title: metric,
        height: PANEL_HEIGHT.M,
        headerActions: ({ metric }) => [new SelectAction({ metric })],
        ...panelOptions,
        ...prefConfig?.panelOptions,
      },
      queryConfig: {
        resolution: QUERY_RESOLUTION.MEDIUM,
        labelMatchers: [],
        addIgnoreUsageFilter: true,
        ...queryOptions,
        ...prefConfig?.queryOptions,
      },
      body: undefined,
    });

    this.addActivationHandler(() => {
      this.onActivate(Boolean(panelOptions?.type || prefConfig?.panelOptions.type));
    });
  }

  private async onActivate(discardPanelTypeUpdates: boolean) {
    const { metric, panelConfig } = this.state;

    const isNativeHistogram = await getTrailFor(this).isNativeHistogram(metric);
    if (isNativeHistogram) {
      this.setState({
        histogramType: 'native',
        panelConfig: discardPanelTypeUpdates
          ? panelConfig
          : { description: 'Native Histogram ', ...panelConfig, type: 'heatmap' },
      });
    }

    this.updateBody();

    this.subscribeToStateChanges();
    this.subscribeToEvents();
  }

  private static getDefaultPanelTypeForMetric(metric: string, histogramType: HistogramType): PanelType {
    if (isStatusUpDownMetric(metric)) {
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
