import { css } from '@emotion/css';
import { DashboardCursorSync, type GrafanaTheme2 } from '@grafana/data';
import {
  behaviors,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { Button, ConfirmModal, useStyles2 } from '@grafana/ui';
import React from 'react';

import { DataTrail } from 'DataTrail';
import { PANEL_HEIGHT } from 'GmdVizPanel/config/panel-heights';
import { GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';
import { reportExploreMetrics } from 'interactions';
import { getTrailFor } from 'utils';
import { GRID_TEMPLATE_COLUMNS } from 'WingmanDataTrail/MetricsList/MetricsList';

import { EventApplyPanelConfig } from './EventApplyPanelConfig';
import { EventCancelConfigurePanel } from './EventCancelConfigurePanel';
import { EventRestorePanelConfig } from './EventRestorePanelConfig';

interface ConfigurePanelFormState extends SceneObjectState {
  metric: string;
  $timeRange: SceneTimeRange;
  controls: SceneObject[];
  isConfirmModalOpen: boolean;
  body?: SceneCSSGridLayout;
}

export const PREVIEW_VIZ_PANEL_HEIGHT = PANEL_HEIGHT.S;

export class ConfigurePanelForm extends SceneObjectBase<ConfigurePanelFormState> {
  constructor({ metric }: { metric: ConfigurePanelFormState['metric'] }) {
    super({
      metric,
      $timeRange: new SceneTimeRange({}),
      controls: [new SceneTimePicker({}), new SceneRefreshPicker({})],
      isConfirmModalOpen: false,
      body: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.syncTimeRange();

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

  private syncTimeRange() {
    const metricScene = sceneGraph.getAncestor(this, DataTrail);
    const { from, to, timeZone, value } = sceneGraph.getTimeRange(metricScene).state;
    sceneGraph.getTimeRange(this).setState({ from, to, timeZone, value });
  }

  private onClickRestoreDefault = () => {
    this.setState({ isConfirmModalOpen: true });
  };

  private onClickConfirmRestoreDefault = () => {
    reportExploreMetrics('default_panel_config_restored', {});
    this.closeConfirmModal();
    this.publishEvent(new EventRestorePanelConfig({ metric: this.state.metric }), true);
  };

  private closeConfirmModal = () => {
    this.setState({ isConfirmModalOpen: false });
  };

  private onClickCancel = () => {
    this.publishEvent(new EventCancelConfigurePanel({ metric: this.state.metric }), true);
  };

  private onClickApplyConfig = () => {
    reportExploreMetrics('panel_config_applied', {});
    this.publishEvent(new EventApplyPanelConfig({ metric: this.state.metric }), true);
  };

  public static readonly Component = ({ model }: SceneComponentProps<ConfigurePanelForm>) => {
    const styles = useStyles2(getStyles);
    const { metric, body, controls, isConfirmModalOpen } = model.useState();

    return (
      <div>
        <div className={styles.controlsContainer}>
          <Button variant="secondary" size="md" onClick={model.onClickRestoreDefault}>
            Restore default config
          </Button>
          <div className={styles.controls}>
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
          </div>
        </div>

        <div className={styles.messageContainer}>
          <p>Choose a Prometheus function that will be used by default to display the {metric} metric.</p>
        </div>

        {body && <body.Component model={body} />}

        <div className={styles.formButtonsContainer}>
          <Button variant="primary" size="md" onClick={model.onClickApplyConfig}>
            Apply
          </Button>
          <Button variant="secondary" size="md" onClick={model.onClickCancel}>
            Cancel
          </Button>
        </div>

        <ConfirmModal
          isOpen={isConfirmModalOpen}
          title="Restore default configuration"
          body="Are you sure you want to restore the default configuration?"
          confirmText="Restore"
          onConfirm={model.onClickConfirmRestoreDefault}
          onDismiss={model.closeConfirmModal}
        />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    controlsContainer: css`
      display: flex;
      justify-content: flex-end;
      gap: ${theme.spacing(1)};
      margin-bottom: ${theme.spacing(2)};
    `,
    messageContainer: css`
      margin: ${theme.spacing(2.5, 0, 1, 0)};
    `,
    controls: css`
      display: flex;
    `,
    formButtonsContainer: css`
      display: flex;
      justify-content: center;
      gap: ${theme.spacing(2)};
      margin-top: ${theme.spacing(3)};
    `,
  };
}
