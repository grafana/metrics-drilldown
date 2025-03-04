import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  PanelBuilders,
  SceneObjectBase,
  SceneQueryRunner,
  VizPanelMenu,
  type SceneComponentProps,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { VAR_DATASOURCE } from 'shared';

import { buildPrometheusQuery } from './buildPrometheusQuery';
import { getPrometheusMetricType } from './getPrometheusMetricType';

export type GroupByLabel = {
  name: string;
  value: string;
};

interface MetricVizPanelState extends SceneObjectState {
  metricName: string;
  color: string;
  groupByLabel?: GroupByLabel;
  body?: VizPanel;
}

export class MetricVizPanel extends SceneObjectBase<MetricVizPanelState> {
  constructor(state: {
    metricName: MetricVizPanelState['metricName'];
    color: MetricVizPanelState['color'];
    groupByLabel: MetricVizPanelState['groupByLabel'];
  }) {
    super({
      key: 'MetricVizPanel',
      metricName: state.metricName,
      color: state.color,
      groupByLabel: state.groupByLabel,
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
    const { metricName, color } = this.state;

    return PanelBuilders.timeseries()
      .setTitle(metricName)
      .setData(this.buildQueryRunner())
      .setColor({ mode: 'fixed', fixedColor: color })
      .setCustomFieldConfig('fillOpacity', 9)
      .setHeaderActions(
        <Button variant="primary" fill="text" size="sm" onClick={() => {}}>
          Select
        </Button>
      )
      .setMenu(this.buildMenu())
      .build();
  }

  buildQueryRunner() {
    const { metricName, groupByLabel } = this.state;

    const expr = buildPrometheusQuery({ metricName, groupByLabel });

    return new SceneQueryRunner({
      datasource: {
        uid: `\$${VAR_DATASOURCE}`,
      },
      queries: [
        {
          refId: `${metricName}-${groupByLabel?.name}`,
          expr,
        },
      ],
    });
  }

  buildMenu() {
    const { metricName } = this.state;

    switch (getPrometheusMetricType(metricName)) {
      case 'counter':
        return new VizPanelMenu({
          items: [
            {
              type: 'group',
              text: '🔥 Prometheus Functions (counter)',
              subMenu: [
                { type: 'divider', text: '' },
                {
                  text: 'avg',
                },
                {
                  text: 'sum',
                },
                {
                  text: 'rate',
                },
              ],
            },
          ],
        });

      case 'gauge':
        return new VizPanelMenu({
          items: [
            {
              type: 'group',
              text: '🔥 Prometheus Functions (gauge)',
              subMenu: [
                { type: 'divider', text: '' },
                {
                  text: 'avg',
                },
              ],
            },
          ],
        });

      case 'histogram':
        return new VizPanelMenu({
          items: [
            {
              type: 'group',
              text: '🔥 Prometheus Functions (histogram)',
              subMenu: [
                { type: 'divider', text: '' },
                {
                  text: 'avg',
                },
              ],
            },
          ],
        });
      default:
        return new VizPanelMenu({
          items: [],
        });
    }
  }

  public static Component = ({ model }: SceneComponentProps<MetricVizPanel>) => {
    const styles = useStyles2(getStyles);
    const { body } = model.useState();

    return <div className={styles.container}>{body && <body.Component model={body} />}</div>;
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({ height: '240px' }),
  };
}
