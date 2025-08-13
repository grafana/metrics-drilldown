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
import { PREF_KEYS } from 'UserPreferences/pref-keys';
import { userPreferences } from 'UserPreferences/userPreferences';
import { getTrailFor } from 'utils';
import { GRID_TEMPLATE_COLUMNS } from 'WingmanDataTrail/MetricsList/MetricsList';

import { EventApplyPanelConfig } from './EventApplyPanelConfig';
import { EventCancelConfigurePanel } from './EventCancelConfigurePanel';
import { EventRestorePanelConfig } from './EventRestorePanelConfig';
import { WithConfigPanelOptions } from './WithConfigPanelOptions';

interface ConfigurePanelFormState extends SceneObjectState {
  metric: string;
  $timeRange: SceneTimeRange;
  controls: SceneObject[];
  isConfirmModalOpen: boolean;
  selectedPresetId?: string;
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
      selectedPresetId: undefined,
      body: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.syncTimeRange();
    this.buildBody();
  }

  private retrieveSelectedPreset() {
    const userPrefs = userPreferences.getItem(PREF_KEYS.METRIC_PREFS);
    const userPrefForMetric = userPrefs && userPrefs[this.state.metric];
    return userPrefForMetric ? userPrefForMetric.config : null;
  }

  private buildBody() {
    const { metric } = this.state;
    const trail = getTrailFor(this);
    const isNativeHistogram = trail.isNativeHistogram(metric);
    const presets = GmdVizPanel.getConfigPresetsForMetric(metric, isNativeHistogram);
    // if not found in the user preferences, we use the first preset
    // it works because they are organized to always have the default one as the first element (see config-presets.ts)
    const selectedPreset = this.retrieveSelectedPreset() || presets[0];
    const selectedPresetId = selectedPreset.id;

    const body = new SceneCSSGridLayout({
      templateColumns: GRID_TEMPLATE_COLUMNS,
      autoRows: PANEL_HEIGHT.M + 18, // see WithConfigPanelOptions
      isLazy: true,
      $behaviors: [
        new behaviors.CursorSync({
          key: 'metricCrosshairSync',
          sync: DashboardCursorSync.Crosshair,
        }),
      ],
      children: presets.map((option, colorIndex) => {
        return new SceneCSSGridItem({
          body: new WithConfigPanelOptions({
            presetId: option.id,
            isSelected: selectedPresetId === option.id,
            onSelect: (presetId) => this.onSelectPreset(presetId),
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
          }),
        });
      }),
    });

    this.setState({ body, selectedPresetId });
  }

  private onSelectPreset = (presetId: string) => {
    reportExploreMetrics('panel_config_selected', { presetId });

    for (const panel of sceneGraph.findDescendents(this, WithConfigPanelOptions)) {
      panel.setState({ isSelected: panel.state.presetId === presetId });
    }

    this.setState({ selectedPresetId: presetId });
  };

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
          <p>Select a Prometheus function that will be used by default to display the {metric} metric.</p>
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
