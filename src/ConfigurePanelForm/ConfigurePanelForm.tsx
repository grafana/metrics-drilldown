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
import { Button, ConfirmModal, useStyles2 } from '@grafana/ui';
import React from 'react';

import { PANEL_HEIGHT } from 'GmdVizPanel/config/panel-heights';
import { GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';
import { reportExploreMetrics } from 'interactions';
import { getTrailFor } from 'utils';
import { GRID_TEMPLATE_COLUMNS } from 'WingmanDataTrail/MetricsList/MetricsList';

import { EventRestoreDefaultConfig } from './EventRestoreDefaultConfig';

interface ConfigurePanelFormState extends SceneObjectState {
  metric: string;
  isModalOpen: boolean;
  body?: SceneCSSGridLayout;
}

export const PREVIEW_VIZ_PANEL_HEIGHT = PANEL_HEIGHT.S;

export class ConfigurePanelForm extends SceneObjectBase<ConfigurePanelFormState> {
  constructor({ metric }: { metric: ConfigurePanelFormState['metric'] }) {
    super({
      metric,
      isModalOpen: false,
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

  private onClickRestoreDefault = () => {
    this.setState({ isModalOpen: true });
  };

  private confirmRestore = () => {
    reportExploreMetrics('default_panel_config_restored', {});
    this.closeModal();
    this.publishEvent(new EventRestoreDefaultConfig({ metric: this.state.metric }), true);
  };

  private closeModal = () => {
    this.setState({ isModalOpen: false });
  };

  public static readonly Component = ({ model }: SceneComponentProps<ConfigurePanelForm>) => {
    const styles = useStyles2(getStyles);
    const { body, isModalOpen } = model.useState();

    return (
      <div className={styles.container}>
        <div className={styles.buttonContainer}>
          <Button variant="secondary" size="sm" onClick={model.onClickRestoreDefault}>
            Restore default configuration
          </Button>
        </div>
        {body && <body.Component model={body} />}
        <ConfirmModal
          isOpen={isModalOpen}
          title="Restore default configuration"
          body="Are you sure you want to restore the default configuration?"
          confirmText="Restore"
          onConfirm={model.confirmRestore}
          onDismiss={model.closeModal}
        />
      </div>
    );
  };
}

function getStyles() {
  return {
    container: css``,
    buttonContainer: css`
      display: flex;
      justify-content: flex-end;
      margin-bottom: 16px;
    `,
  };
}
