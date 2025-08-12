import { css } from '@emotion/css';
import { DashboardCursorSync } from '@grafana/data';
import {
  behaviors,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { PANEL_HEIGHT } from 'GmdVizPanel/config/panel-heights';
import { GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';
import { getTrailFor } from 'utils';
import { GRID_TEMPLATE_COLUMNS } from 'WingmanDataTrail/MetricsList/MetricsList';

interface ConfigurePrometheusFunctionFormState extends SceneObjectState {
  metric: string;
  body?: SceneCSSGridLayout;
}

export const PREVIEW_VIZ_PANEL_HEIGHT = PANEL_HEIGHT.S;

export class ConfigurePrometheusFunctionForm extends SceneObjectBase<ConfigurePrometheusFunctionFormState> {
  constructor({ metric }: { metric: ConfigurePrometheusFunctionFormState['metric'] }) {
    super({
      metric,
      body: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const { metric } = this.state;
    const trail = getTrailFor(this);
    const isNativeHistogram = trail.isNativeHistogram(metric);

    const body = new SceneCSSGridLayout({
      templateColumns: GRID_TEMPLATE_COLUMNS,
      autoRows: PANEL_HEIGHT.M,
      isLazy: true,
      $behaviors: [
        new behaviors.CursorSync({
          key: 'metricCrosshairSync',
          sync: DashboardCursorSync.Crosshair,
        }),
      ],
      children: GmdVizPanel.getConfigPresetsForMetric(metric, isNativeHistogram).map((option, colorIndex) => {
        return new SceneCSSGridItem({
          body: new GmdVizPanel({
            metric,
            panelOptions: {
              ...option.panelOptions,
              title: option.name,
              fixedColorIndex: colorIndex,
              headerActions: () => [],
            },
            queryOptions: option.queryOptions,
          }),
        });
      }),
    });

    this.setState({ body });
  }

  public static readonly Component = ({ model }: SceneComponentProps<ConfigurePrometheusFunctionForm>) => {
    const styles = useStyles2(getStyles);
    const { body } = model.useState();

    return <div className={styles.container}>{body && <body.Component model={body} />}</div>;
  };
}

function getStyles() {
  return {
    container: css``,
  };
}
