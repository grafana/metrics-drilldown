import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectBase,
  SceneQueryRunner,
  type SceneComponentProps,
  type SceneObjectState,
  type VizPanel,
  type VizPanelState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { trailDS } from 'shared';

import { ConfigureAction, type PrometheusFn } from './actions/ConfigureAction';
import { SelectAction } from './actions/SelectAction';
import { buildPrometheusQuery } from './buildPrometheusQuery';
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
  headerActions: VizPanelState['headerActions'];
  matchers: string[];
  body: VizPanel;
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
    headerActions?: MetricVizPanelState['headerActions'];
    hideLegend?: MetricVizPanelState['hideLegend'];
    height?: MetricVizPanelState['height'];
    highlight?: MetricVizPanelState['highlight'];
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
        new SelectAction({ metricName: state.metricName }),
        new ConfigureAction({ metricName: state.metricName }),
      ],
    };

    super({
      key: 'MetricVizPanel',
      ...stateWithDefaults,
      body: MetricVizPanel.buildVizPanel(stateWithDefaults),
    });
  }

  private static buildVizPanel({
    metricName,
    title,
    highlight,
    color,
    headerActions,
    hideLegend,
    prometheusFunction,
    matchers,
  }: {
    metricName: string;
    title: string;
    highlight: boolean;
    color: string;
    headerActions: VizPanelState['headerActions'];
    hideLegend: boolean;
    prometheusFunction: PrometheusFn;
    matchers: string[];
  }) {
    // console.log('*** buildVizPanel', title);
    const panelTitle = highlight ? `${title} (current)` : title;

    const isUptime = metricName === 'up' || metricName.endsWith('_up');
    if (isUptime) {
      // For uptime metrics, use a status history panel which is better for binary states
      return buildStatusHistoryPanel({
        panelTitle,
        queryRunner: MetricVizPanel.buildQueryRunner({
          metricName,
          matchers,
          prometheusFunction,
        }),
      }).build();
    }

    // Default settings for non-uptime metrics - use timeseries
    return buildTimeseriesPanel({
      panelTitle,
      color,
      headerActions,
      hideLegend,
      queryRunner: MetricVizPanel.buildQueryRunner({
        metricName,
        matchers,
        prometheusFunction,
      }),
    }).build();
  }

  private static buildQueryRunner({
    metricName,
    matchers,
    prometheusFunction,
  }: {
    metricName: string;
    matchers: string[];
    prometheusFunction: PrometheusFn;
  }): SceneQueryRunner {
    const expr = buildPrometheusQuery({ metricName, matchers, fn: prometheusFunction });

    return new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: MetricVizPanel.MAX_DATA_POINTS,
      queries: [
        {
          refId: metricName,
          expr,
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
