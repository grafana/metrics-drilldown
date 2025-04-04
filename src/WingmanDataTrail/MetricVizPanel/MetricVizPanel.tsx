import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectBase,
  SceneQueryRunner,
  type SceneComponentProps,
  type SceneDataQuery,
  type SceneObject,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { getUnit } from 'autoQuery/units';
import { trailDS } from 'shared';

import { ConfigureAction, type PrometheusFn } from './actions/ConfigureAction';
import { SelectAction } from './actions/SelectAction';
import { buildPrometheusQuery } from './buildPrometheusQuery';
import { NativeHistogramBadge } from './NativeHistogramBadge';
import { buildHeatmapPanel } from './panels/heatmap';
import { buildStatusHistoryPanel } from './panels/statushistory';
import { buildTimeseriesPanel } from './panels/timeseries';

interface MetricVizPanelState extends SceneObjectState {
  metricName: string;
  color: string;
  prometheusFunction: PrometheusFn;
  title: string;
  hideLegend: boolean;
  highlight: boolean;
  height: string;
  matchers: string[];
  body: VizPanel;
  headerActions: SceneObject[];
  isNativeHistogram?: boolean;
}

export const METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW = '240px';
export const METRICS_VIZ_PANEL_HEIGHT = '200px';
export const METRICS_VIZ_PANEL_HEIGHT_SMALL = '160px';

export class MetricVizPanel extends SceneObjectBase<MetricVizPanelState> {
  private static readonly MAX_DATA_POINTS = 250;

  constructor(state: {
    metricName: MetricVizPanelState['metricName'];
    color: MetricVizPanelState['color'];
    prometheusFunction?: MetricVizPanelState['prometheusFunction'];
    matchers?: MetricVizPanelState['matchers'];
    title?: MetricVizPanelState['title'];
    hideLegend?: MetricVizPanelState['hideLegend'];
    height?: MetricVizPanelState['height'];
    highlight?: MetricVizPanelState['highlight'];
    headerActions?: SceneObject[];
    isNativeHistogram?: boolean;
  }) {
    const stateWithDefaults = {
      ...state,
      prometheusFunction: state.prometheusFunction || 'sum',
      matchers: state.matchers || [],
      title: state.title || state.metricName,
      height: state.height || METRICS_VIZ_PANEL_HEIGHT,
      hideLegend: Boolean(state.hideLegend),
      highlight: Boolean(state.highlight),
      headerActions: state.headerActions || [
        ...(state.isNativeHistogram ? [new NativeHistogramBadge({})] : []),
        new SelectAction({ metricName: state.metricName }),
        new ConfigureAction({ metricName: state.metricName }),
      ],
    };

    super({
      key: `metric-viz-panel-${stateWithDefaults.metricName}`,
      ...stateWithDefaults,
      body: MetricVizPanel.buildVizPanel({
        ...stateWithDefaults,
        isNativeHistogram: state.isNativeHistogram,
      }),
    });
  }

  private static buildVizPanel({
    metricName,
    title,
    highlight,
    color,
    hideLegend,
    prometheusFunction,
    matchers,
    headerActions,
    isNativeHistogram = false,
  }: {
    metricName: MetricVizPanelState['metricName'];
    title: MetricVizPanelState['title'];
    highlight: MetricVizPanelState['highlight'];
    color: MetricVizPanelState['color'];
    hideLegend: MetricVizPanelState['hideLegend'];
    prometheusFunction: MetricVizPanelState['prometheusFunction'];
    matchers: MetricVizPanelState['matchers'];
    headerActions: MetricVizPanelState['headerActions'];
    isNativeHistogram?: boolean;
  }) {
    const panelTitle = highlight ? `${title} (current)` : title;
    const unit = getUnit(metricName);

    const isUptime = metricName === 'up' || metricName.endsWith('_up');
    if (isUptime) {
      // For uptime metrics, use a status history panel which is better for binary states
      return buildStatusHistoryPanel({
        panelTitle,
        headerActions,
        // TODO: custom uptime query runner to prevent if/else in buildPrometheusQuery() (see below)
        queryRunner: MetricVizPanel.buildQueryRunner({
          metricName,
          matchers,
          prometheusFunction,
        }),
      })
        .setUnit(unit) // Set the appropriate unit for status history panel as well
        .build();
    }

    // check if metric is a histogram (either classic or native)
    const isHistogram = metricName.endsWith('_bucket') || isNativeHistogram;
    if (isHistogram) {
      return buildHeatmapPanel({
        panelTitle,
        headerActions,
        color,
        hideLegend,
        queryRunner: MetricVizPanel.buildQueryRunner({
          metricName,
          matchers,
          prometheusFunction: 'rate',
          groupByLabel: 'le',
          queryOptions: {
            format: 'heatmap',
          },
        }),
      })
        .setUnit(unit)
        .build();
    }

    // Default settings for non-uptime metrics - use timeseries
    return buildTimeseriesPanel({
      panelTitle,
      headerActions,
      color,
      hideLegend,
      queryRunner: MetricVizPanel.buildQueryRunner({
        metricName,
        matchers,
        prometheusFunction,
      }),
    })
      .setUnit(unit) // Set the appropriate unit
      .build();
  }

  private static buildQueryRunner({
    metricName,
    matchers,
    prometheusFunction,
    groupByLabel,
    queryOptions = {},
  }: {
    metricName: string;
    matchers: string[];
    prometheusFunction: PrometheusFn;
    groupByLabel?: string;
    queryOptions?: Partial<SceneDataQuery>;
  }): SceneQueryRunner {
    let expr = buildPrometheusQuery({ metricName, matchers, fn: prometheusFunction, groupByLabel });

    return new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: MetricVizPanel.MAX_DATA_POINTS,
      queries: [
        {
          ...queryOptions,
          refId: metricName,
          expr,
          fromExploreMetrics: true,
        },
      ],
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricVizPanel>) => {
    const { body, height, highlight } = model.useState();
    const styles = useStyles2(getStyles, height);

    return (
      <div className={cx(styles.container, highlight && styles.highlight)}>
        {body && <body.Component model={body} />}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, height: string) {
  return {
    container: css({
      height,
    }),
    highlight: css({
      border: `2px solid ${theme.colors.primary.main}`,
    }),
  };
}
