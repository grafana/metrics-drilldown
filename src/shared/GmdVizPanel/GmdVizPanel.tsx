import { css } from '@emotion/css';
import { DataFrameType, LoadingState, type GrafanaTheme2, type ValueMapping } from '@grafana/data';
import {
  SceneObjectBase,
  type SceneComponentProps,
  type SceneDataProvider,
  type SceneObjectState,
  type VizPanel,
  type VizPanelState,
} from '@grafana/scenes';
import { useStyles2, type VizLegendOptions } from '@grafana/ui';
import { isEqual } from 'lodash';
import React from 'react';

import { getMetricDescription } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { getTrailFor } from 'shared/utils/utils';

import { type LabelMatcher } from './buildQueryExpression';
import { EventPanelTypeChanged } from './components/EventPanelTypeChanged';
import { SelectAction } from './components/SelectAction';
import { getPreferredConfigForMetric } from './config/getPreferredConfigForMetric';
import { PANEL_HEIGHT } from './config/panel-heights';
import { type PrometheusFunction } from './config/promql-functions';
import { QUERY_RESOLUTION } from './config/query-resolutions';
import { getMetricTypeSync, type MetricType } from './matchers/getMetricType';
import { getPanelTypeForMetricSync } from './matchers/getPanelTypeForMetric';
import { type PanelType } from './types/available-panel-types';
import { buildHeatmapPanel } from './types/heatmap/buildHeatmapPanel';
import { buildPercentilesPanel } from './types/percentiles/buildPercentilesPanel';
import { buildStatPanel } from './types/stat/buildStatPanel';
import { buildStatushistoryPanel } from './types/statushistory/buildStatushistoryPanel';
import { buildTimeseriesPanel } from './types/timeseries/buildTimeseriesPanel';

/* Panel config */

type HeaderActionAndMenuArgs = { metric: string; panelConfig: PanelConfig };

export type PanelConfig = {
  type: PanelType;
  title: string;
  height: PANEL_HEIGHT;
  headerActions: (headerActionsArgs: HeaderActionAndMenuArgs) => VizPanelState['headerActions'];
  fixedColorIndex?: number;
  description?: string;
  addMetadataDescription?: boolean;
  menu?: (menuArgs: HeaderActionAndMenuArgs) => VizPanelState['menu'];
  legend?: Partial<VizLegendOptions>;
  mappings?: ValueMapping[];
  behaviors?: VizPanelState['$behaviors'];
};

export type PanelOptions = {
  type?: PanelConfig['type'];
  height?: PanelConfig['height'];
  fixedColorIndex?: PanelConfig['fixedColorIndex'];
  title?: PanelConfig['title'];
  description?: PanelConfig['description'];
  addMetadataDescription?: PanelConfig['addMetadataDescription'];
  headerActions?: PanelConfig['headerActions'];
  menu?: PanelConfig['menu'];
  legend?: PanelConfig['legend'];
  mappings?: PanelConfig['mappings'];
  behaviors?: PanelConfig['behaviors'];
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
  addExtremeValuesFiltering?: boolean;
  groupBy?: string;
  queries?: QueryDefs;
  data?: SceneDataProvider;
};

export type QueryOptions = {
  resolution?: QueryConfig['resolution'];
  labelMatchers?: QueryConfig['labelMatchers'];
  groupBy?: string;
  queries?: QueryDefs;
  data?: QueryConfig['data'];
};

/* GmdVizPanelState */

interface GmdVizPanelState extends SceneObjectState {
  metric: string;
  metricType: MetricType;
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
    // we want a metric and panel type now to be able to render the panel as soon as possible after activation
    // so we use sync/fast heuristsics before using a 100% correct async method in onActivate() (fetching the metric metadata)
    const metricType = getMetricTypeSync(metric) as MetricType;
    const prefConfig = discardUserPrefs ? undefined : getPreferredConfigForMetric(metric);

    super({
      key,
      metric,
      metricType,
      panelConfig: {
        type: panelOptions?.type || getPanelTypeForMetricSync(metric),
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
    this.updateBody();

    this.subscribeToStateChanges(discardPanelTypeUpdates);
    this.subscribeToEvents();

    this.checkMetricMetadata(discardPanelTypeUpdates);
  }

  private async checkMetricMetadata(discardPanelTypeUpdates: boolean) {
    const { metric, metricType, panelConfig } = this.state;

    const metadata = await getTrailFor(this).getMetadataForMetric(metric);
    if (!metadata?.type) {
      return;
    }

    const stateUpdate: Partial<GmdVizPanelState> = {};
    const panelConfigUpdate: Partial<GmdVizPanelState['panelConfig']> = {};

    if (metadata && panelConfig.addMetadataDescription) {
      panelConfigUpdate.description = getMetricDescription(metadata);
    }

    // native histogram
    if (metadata.type === 'histogram') {
      stateUpdate.metricType = 'native-histogram';
      panelConfigUpdate.description ??= panelConfig.description ?? 'Native Histogram';

      if (!discardPanelTypeUpdates) {
        panelConfigUpdate.type = 'heatmap';
      }
    }

    // gauge that the app mis-identified as counter (see https://github.com/grafana/metrics-drilldown/issues/698)
    if (metadata.type === 'gauge' && metricType === 'counter') {
      stateUpdate.metricType = 'gauge';
    }

    if (Object.keys(stateUpdate).length || Object.keys(panelConfigUpdate).length) {
      this.setState({
        ...stateUpdate,
        panelConfig: { ...panelConfig, ...panelConfigUpdate },
      });
    }
  }

  private subscribeToStateChanges(discardPanelTypeUpdates: boolean) {
    const { metricType, body, panelConfig } = this.state;

    // in addition to using the metadata fetched in src/helpers/MetricDatasourceHelper.ts to determine if the metric is a native histogram or not,
    // we give another chance to display it properly by looking into the data frame type received
    if (!discardPanelTypeUpdates && !['classic-histogram', 'native-histogram'].includes(metricType)) {
      const bodySub = (body?.state.$data as SceneDataProvider)?.subscribeToState((newState) => {
        if (newState.data?.state !== LoadingState.Done) {
          return;
        }

        const dataFrameType = newState.data.series[0]?.meta?.type;
        if (!dataFrameType) {
          return;
        }

        if (dataFrameType === DataFrameType.HeatmapCells) {
          this.setState({
            panelConfig: { description: 'Native Histogram ', ...panelConfig, type: 'heatmap' },
          });
        }

        bodySub.unsubscribe();
      });

      this._subs.add(bodySub);
    }

    this.subscribeToState((newState, prevState) => {
      if (
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
    const { metric: name, metricType, panelConfig, queryConfig } = this.state;
    const metric = { name, type: metricType };

    switch (panelConfig.type) {
      case 'timeseries':
        this.setState({
          body: buildTimeseriesPanel({ metric, panelConfig, queryConfig }),
        });
        return;

      case 'heatmap':
        this.setState({
          body: buildHeatmapPanel({ metric, panelConfig, queryConfig }),
        });
        return;

      case 'percentiles':
        this.setState({
          body: buildPercentilesPanel({
            metric,
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
