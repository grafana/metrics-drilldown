import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  PanelBuilders,
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

export type GroupByLabel = {
  name: string;
  value: string;
};

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
  body?: VizPanel;
  groupByLabel?: GroupByLabel;
}

export const METRICS_VIZ_PANEL_HEIGHT = '200px';
export const METRICS_VIZ_PANEL_HEIGHT_SMALL = '160px';

export class MetricVizPanel extends SceneObjectBase<MetricVizPanelState> {
  constructor(state: {
    metricName: MetricVizPanelState['metricName'];
    color: MetricVizPanelState['color'];
    prometheusFunction?: MetricVizPanelState['prometheusFunction'];
    groupByLabel: MetricVizPanelState['groupByLabel'];
    matchers?: MetricVizPanelState['matchers'];
    title?: MetricVizPanelState['title'];
    headerActions?: MetricVizPanelState['headerActions'];
    hideLegend?: MetricVizPanelState['hideLegend'];
    height?: MetricVizPanelState['height'];
    highlight?: MetricVizPanelState['highlight'];
  }) {
    super({
      key: 'MetricVizPanel',
      metricName: state.metricName,
      color: state.color,
      prometheusFunction: state.prometheusFunction || 'sum',
      groupByLabel: state.groupByLabel,
      matchers: state.matchers || [],
      title: state.title || state.metricName,
      height: state.height || METRICS_VIZ_PANEL_HEIGHT,
      hideLegend: Boolean(state.hideLegend),
      highlight: Boolean(state.highlight),
      headerActions: state.headerActions || [
        new SelectAction({ metricName: state.metricName }),
        new ConfigureAction({ metricName: state.metricName }),
      ],
      body: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.setState({
      body: this.buildVizPanel(),
    });
  }

  buildVizPanel() {
    const { title, color, headerActions, hideLegend, highlight } = this.state;

    return PanelBuilders.timeseries()
      .setTitle(highlight ? `${title} (current)` : title)
      .setData(this.buildQueryRunner())
      .setColor({ mode: 'fixed', fixedColor: color })
      .setCustomFieldConfig('fillOpacity', 9)
      .setHeaderActions(headerActions)
      .setOption('legend', { showLegend: !hideLegend })
      .build();
  }

  buildQueryRunner() {
    const { metricName, matchers, groupByLabel, prometheusFunction: fn } = this.state;

    const expr = buildPrometheusQuery({ metricName, matchers, groupByLabel, fn });

    return new SceneQueryRunner({
      datasource: trailDS,
      maxDataPoints: 250,
      queries: [
        {
          refId: `${metricName}-${groupByLabel?.name}`,
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
