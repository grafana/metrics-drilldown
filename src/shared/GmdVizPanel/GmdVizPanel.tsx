import { css } from '@emotion/css';
import { DataFrameType, LoadingState, type GrafanaTheme2, type ValueMapping } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObjectBase,
  SceneQueryRunner,
  type SceneComponentProps,
  type SceneDataProvider,
  type SceneObjectState,
  type VizPanel,
  type VizPanelState,
} from '@grafana/scenes';
import { useStyles2, type VizLegendOptions } from '@grafana/ui';
import { isEqual, omitBy } from 'lodash';
import React from 'react';

import { trailDS } from 'shared/shared';
import { getTrailFor } from 'shared/utils/utils';
import { getClickablePanelStyles } from 'shared/utils/utils.styles';

import { buildNativeHistogramProbeExpr } from './buildNativeHistogramProbeExpr';
import { type LabelMatcher } from './buildQueryExpression';
import { EventPanelTypeChanged } from './components/EventPanelTypeChanged';
import { SelectAction } from './components/SelectAction';
import { getPreferredConfigForMetric } from './config/getPreferredConfigForMetric';
import { PANEL_HEIGHT } from './config/panel-heights';
import { type PrometheusFunction } from './config/promql-functions';
import { QUERY_RESOLUTION } from './config/query-resolutions';
import { getMetricType, getMetricTypeSync, type Metric, type MetricType } from './matchers/getMetricType';
import { getPanelTypeForMetricSync } from './matchers/getPanelTypeForMetric';
import { type KgMetricType } from './matchers/mapKgMetricType';
import { type PanelType } from './types/available-panel-types';
import { panelBuilder } from './types/panelBuilder';

/* Panel config */

type HeaderActionAndMenuArgs = { metric: Metric; panelConfig: PanelConfig };

export type PanelConfig = {
  type: PanelType;
  title: string;
  height: PANEL_HEIGHT;
  headerActions: (headerActionsArgs: HeaderActionAndMenuArgs) => VizPanelState['headerActions'];
  titleItems?: (titleItemsArgs: HeaderActionAndMenuArgs) => VizPanelState['titleItems'];
  fixedColorIndex?: number;
  description?: string;
  menu?: (menuArgs: HeaderActionAndMenuArgs) => VizPanelState['menu'];
  legend?: Partial<VizLegendOptions>;
  mappings?: ValueMapping[];
  behaviors?: NonNullable<VizPanelState['$behaviors']>;
};

export type PanelOptions = {
  type?: PanelConfig['type'];
  height?: PanelConfig['height'];
  fixedColorIndex?: NonNullable<PanelConfig['fixedColorIndex']>;
  title?: PanelConfig['title'];
  description?: NonNullable<PanelConfig['description']>;
  headerActions?: PanelConfig['headerActions'];
  titleItems?: NonNullable<PanelConfig['titleItems']>;
  menu?: NonNullable<PanelConfig['menu']>;
  legend?: NonNullable<PanelConfig['legend']>;
  mappings?: NonNullable<PanelConfig['mappings']>;
  behaviors?: NonNullable<PanelConfig['behaviors']>;
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
  // Replaces $__rate_interval inside rate(metric[X]). Prometheus duration string, e.g. '5m', '1h'.
  customRateInterval?: string;
  customFunction?: string;
  kgMetricType?: KgMetricType;
  // A complete PromQL expression (a KG binary/ratio insight query) that replaces the metric selector.
  // When set, the builder uses it verbatim as the query body (no selector composition, no rate wrap);
  // only the group-by aggregation wrapper from the convention is applied around it.
  binaryExpr?: string;
  // Legend for a non-grouped binaryExpr query. Defaults to "binary query" (main panel); the per-value
  // breakdown passes the label value so each value panel legends with its value, not "binary query".
  binaryLegend?: string;
};

export type QueryOptions = {
  resolution?: QueryConfig['resolution'];
  labelMatchers?: QueryConfig['labelMatchers'];
  groupBy?: string;
  queries?: QueryDefs;
  data?: NonNullable<QueryConfig['data']>;
  customRateInterval?: NonNullable<QueryConfig['customRateInterval']>;
  customFunction?: NonNullable<QueryConfig['customFunction']>;
  kgMetricType?: NonNullable<QueryConfig['kgMetricType']>;
  binaryExpr?: NonNullable<QueryConfig['binaryExpr']>;
  binaryLegend?: NonNullable<QueryConfig['binaryLegend']>;
};

/* GmdVizPanelState */

interface GmdVizPanelState extends SceneObjectState {
  metric: string;
  metricType: MetricType;
  panelConfig: PanelConfig;
  queryConfig: QueryConfig;
  body?: VizPanel;
  onClick?: () => void; // For embeddedMini click navigation
  clickTitle?: string; // Hover text for embeddedMini
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
    // note: when the metric type changes after fetching the metadata, the correct type is cached and is available in getMetricTypeSync()
    const metricType = getMetricTypeSync(metric, queryOptions?.kgMetricType) as MetricType;
    const prefConfig = discardUserPrefs ? undefined : getPreferredConfigForMetric(metric);

    super({
      key,
      metric,
      metricType,
      panelConfig: {
        type: panelOptions?.type || getPanelTypeForMetricSync(metric, queryOptions?.kgMetricType),
        title: metric,
        height: PANEL_HEIGHT.M,
        headerActions: ({ metric }) => [new SelectAction({ metric: metric.name })],
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
    this.buildVizPanel();

    this.subscribeToStateChanges(discardPanelTypeUpdates);
    this.subscribeToEvents();

    this.checkMetricMetadata(discardPanelTypeUpdates);
  }

  private async checkMetricMetadata(discardPanelTypeUpdates: boolean) {
    const { metric, queryConfig } = this.state;

    if (queryConfig.kgMetricType) {
      return;
    }

    const metricTypeFromMetadata = await getMetricType(metric, getTrailFor(this));

    const { metricType } = this.state;

    // we found a gauge metric that was previously identified as a counter (see https://github.com/grafana/metrics-drilldown/issues/698)
    if (metricTypeFromMetadata === 'gauge' && metricType === 'counter') {
      this.setState({ metricType: 'gauge' });
    }
    // or the opposite
    if (metricTypeFromMetadata === 'counter' && metricType === 'gauge') {
      this.setState({ metricType: 'counter' });
    }
    // summaries always start out mis-detected as a gauge (no sync name heuristic)
    if (metricTypeFromMetadata === 'summary' && metricType === 'gauge') {
      this.setState({ metricType: 'summary' });
    }

    // Native histograms — notably adaptive/aggregated ones — can expose no metadata and cannot be queried
    // without rate()+aggregation, so the default gauge query returns empty and the metric is mis-typed as a
    // gauge. When there's no metadata and we still think it's a gauge, run a rated probe query: if it comes
    // back as a native-histogram (HeatmapCells) frame with data, switch the panel to a heatmap.
    if (metricTypeFromMetadata === 'gauge' && this.state.metricType === 'gauge') {
      const metadata = await getTrailFor(this).getMetadataForMetric(metric); // cached from getMetricType() above
      if (!metadata) {
        this.detectNativeHistogram(discardPanelTypeUpdates);
      }
    }
  }

  /**
   * Runs a one-shot rated probe query (`sum(rate(metric[interval]))`) to detect a native histogram that
   * the sync heuristics and metadata both miss (notably adaptive/aggregated native histograms, which
   * expose no metadata and return empty for the default gauge query).
   *
   * The probe runs on a temporary query runner attached to this panel's `$data` slot so it inherits scene
   * context (time range, variables, datasource). This is safe only because the rendered `body` always owns
   * its own `$data`, so nothing resolves upward to this probe during the probe window. The probe never
   * renders. Only a native-histogram (HeatmapCells) frame with rows flips the panel to a heatmap — an empty
   * result is inconclusive and is neither cached nor acted on.
   */
  private detectNativeHistogram(discardPanelTypeUpdates: boolean) {
    const { metric, queryConfig } = this.state;
    const trail = getTrailFor(this);

    const cached = trail.getCachedNativeHistogram(metric);
    if (cached !== undefined) {
      if (cached) {
        this.switchToNativeHistogramHeatmap(discardPanelTypeUpdates);
      }
      return;
    }

    const probeExpr = buildNativeHistogramProbeExpr(metric, queryConfig);

    const probe = new SceneQueryRunner({
      datasource: trailDS,
      queries: [{ refId: `${metric}-nh-probe`, expr: probeExpr, fromExploreMetrics: true }],
    });

    // attaching to $data parents the runner (so it interpolates against the scene) and activates it
    this.setState({ $data: probe });

    const sub = probe.subscribeToState((newState) => {
      const loadingState = newState.data?.state;
      // Wait for a terminal state; Done and Error are the only ones for a one-shot query.
      if (loadingState !== LoadingState.Done && loadingState !== LoadingState.Error) {
        return;
      }

      sub.unsubscribe();
      this.setState({ $data: undefined }); // remove the temporary probe provider (deactivates the runner)

      // A failed or empty probe is inconclusive (e.g. query error, or no data in the current time range):
      // don't cache and don't switch, so the metric can be probed again on a later activation.
      if (loadingState === LoadingState.Error) {
        return;
      }

      const firstFrame = newState.data?.series?.[0];
      if (!firstFrame?.length) {
        return;
      }

      const isNativeHistogram = firstFrame.meta?.type === DataFrameType.HeatmapCells;
      trail.setCachedNativeHistogram(metric, isNativeHistogram);

      if (isNativeHistogram) {
        this.switchToNativeHistogramHeatmap(discardPanelTypeUpdates);
      }
    });

    this._subs.add(sub);
  }

  private switchToNativeHistogramHeatmap(discardPanelTypeUpdates: boolean) {
    if (this.state.metricType === 'native-histogram') {
      return;
    }

    // When a caller pinned the panel type (discardPanelTypeUpdates), only correct the metric type and leave
    // the requested panel type alone — mirroring the data-frame detection path in subscribeToStateChanges().
    if (discardPanelTypeUpdates) {
      this.setState({ metricType: 'native-histogram' });
      return;
    }

    this.setState({
      metricType: 'native-histogram',
      panelConfig: {
        description: t('gmd-viz-panel.native-histogram', 'Native Histogram'),
        ...this.state.panelConfig,
        type: 'heatmap',
      },
    });
  }

  private subscribeToStateChanges(discardPanelTypeUpdates: boolean) {
    const { metricType, body } = this.state;

    // in addition to using the metadata fetched in src/helpers/MetricDatasourceHelper.ts to determine if the metric is a native histogram or not,
    // we give another chance to display it properly by looking into the data frame type received
    const isKgHistogramHint = this.state.queryConfig.kgMetricType === 'histogram';
    if (isKgHistogramHint || !['classic-histogram', 'native-histogram'].includes(metricType)) {
      const bodySub = (body?.state.$data as SceneDataProvider)?.subscribeToState((newState) => {
        if (newState.data?.state !== LoadingState.Done) {
          return;
        }

        // Always unsubscribe on first Done event — prevents multiple firings.
        bodySub.unsubscribe();

        const dataFrameType = newState.data.series?.[0]?.meta?.type;
        if (!dataFrameType) {
          return;
        }

        if (dataFrameType === DataFrameType.HeatmapCells) {
          if (this.state.panelConfig.type === 'heatmap') {
            return;
          }

          if (discardPanelTypeUpdates) {
            this.setState({ metricType: 'native-histogram' });
          } else {
            this.setState({
              metricType: 'native-histogram',
              panelConfig: {
                description: t('gmd-viz-panel.native-histogram', 'Native Histogram'),
                ...this.state.panelConfig,
                type: 'heatmap',
              },
            });
          }
        }
      });

      this._subs.add(bodySub);
    }

    this.subscribeToState((newState, prevState) => {
      if (newState.panelConfig.type !== prevState.panelConfig.type) {
        this.buildVizPanel(); // rebuild the whole panel
        return;
      }

      if (!isEqual(newState.panelConfig, prevState.panelConfig)) {
        const diff = omitBy(
          newState.panelConfig,
          (value, key) => value === prevState.panelConfig[key as keyof typeof prevState.panelConfig]
        );
        this.updatePanelOptions(diff); // update only the panel options that have changed
      }

      if (newState.metricType !== prevState.metricType || !isEqual(newState.queryConfig, prevState.queryConfig)) {
        this.updatePanelQueries(); // update the panel queries
        // update the header actions and the menu because they have received the wrong type during the 1st render
        this.updatePanelOptions({
          headerActions: newState.panelConfig.headerActions,
          menu: newState.panelConfig.menu,
        });
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

  private buildVizPanel() {
    const { metric: name, metricType, panelConfig, queryConfig } = this.state;

    this.setState({
      body: panelBuilder.buildVizPanel({
        metric: { name, type: metricType },
        panelConfig,
        queryConfig,
      }),
    });
  }

  private updatePanelOptions(update: Partial<PanelOptions>) {
    const { metric: name, metricType, body, panelConfig } = this.state;
    if (!body) {
      return;
    }

    const metric = {
      name,
      type: metricType,
    };

    // we support only a subset of options that work for the current app
    // in the future, if we want to add more support, check each buildXYZPanel functions
    if (update.description) {
      body.setState({ description: update.description });
    }

    if (update.headerActions) {
      body.setState({ headerActions: update.headerActions({ metric, panelConfig }) });
    }

    if (update.titleItems) {
      body.setState({ titleItems: update.titleItems({ metric, panelConfig }) });
    }

    if (update.menu) {
      body.setState({ menu: update.menu({ metric, panelConfig }) });
    }
  }

  private updatePanelQueries() {
    const { body, metric, metricType, panelConfig, queryConfig } = this.state;
    if (!body) {
      return;
    }

    const [queryRunner] = sceneGraph.findDescendents(body, SceneQueryRunner);
    if (!queryRunner) {
      return;
    }

    const queryRunnerParams = panelBuilder.getQueryRunnerParams({
      panelType: panelConfig.type,
      metric: { name: metric, type: metricType },
      queryConfig,
    });

    queryRunner.setState({
      queries: queryRunnerParams.queries,
    });

    queryRunner.runQueries(); // Scenes will cancel any running query
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
    const { body, panelConfig, onClick, clickTitle } = model.useState();
    const styles = useStyles2(getStyles, panelConfig.height, Boolean(onClick));

    const handleKeyDown = onClick
      ? (event: React.KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        }
      : undefined;

    return (
      <div
        className={styles.container}
        data-testid="gmd-vizpanel"
        onClick={onClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        title={clickTitle}
        aria-label={onClick ? clickTitle : undefined}
      >
        {body && <body.Component model={body} />}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, height: PANEL_HEIGHT, isClickable: boolean) {
  return {
    container: css`
      width: 100%;
      height: ${height}px;
      ${isClickable ? getClickablePanelStyles(theme) : ''}
    `,
  };
}
