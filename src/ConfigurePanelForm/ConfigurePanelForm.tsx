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
import { omit } from 'lodash';
import React from 'react';

import { DataTrail } from 'DataTrail';
import { PANEL_HEIGHT } from 'GmdVizPanel/config/panel-heights';
import { getConfigPresetsForMetric } from 'GmdVizPanel/config/presets/getConfigPresetsForMetric';
import { type PanelConfigPreset } from 'GmdVizPanel/config/presets/types';
import { GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';
import { PREF_KEYS } from 'UserPreferences/pref-keys';
import { userPreferences } from 'UserPreferences/userPreferences';
import { getTrailFor } from 'utils';
import { displayError } from 'WingmanDataTrail/helpers/displayStatus';
import { GRID_TEMPLATE_COLUMNS } from 'WingmanDataTrail/MetricsList/MetricsList';

import { EventApplyPanelConfig } from './EventApplyPanelConfig';
import { EventCancelConfigurePanel } from './EventCancelConfigurePanel';
import { WithConfigPanelOptions } from './WithConfigPanelOptions';

interface ConfigurePanelFormState extends SceneObjectState {
  metric: string;
  $timeRange: SceneTimeRange;
  controls: SceneObject[];
  isConfirmModalOpen: boolean;
  presets: PanelConfigPreset[];
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
      presets: [],
      selectedPresetId: undefined,
      body: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.syncTimeRange();
    this.buildBody();
    this.subscribeToEvents();
  }

  private syncTimeRange() {
    const metricScene = sceneGraph.getAncestor(this, DataTrail);
    const { from, to, timeZone, value } = sceneGraph.getTimeRange(metricScene).state;
    sceneGraph.getTimeRange(this).setState({ from, to, timeZone, value });
  }

  private buildBody() {
    const { metric } = this.state;
    const trail = getTrailFor(this);
    const isNativeHistogram = trail.isNativeHistogram(metric);
    const presets = getConfigPresetsForMetric(metric, isNativeHistogram);
    // if not found in the user preferences, we use the first preset
    // it works because they are organized to always have the default one as the first element (see config-presets.ts)
    const selectedPresetId = (this.retrieveSelectedPreset() || presets[0]).id;

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
              discardUserPrefs: true,
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

    this.setState({ presets, selectedPresetId, body });
  }

  private onSelectPreset = (presetId: string) => {
    for (const panel of sceneGraph.findDescendents(this, WithConfigPanelOptions)) {
      panel.setState({ isSelected: panel.state.presetId === presetId });
    }

    this.setState({ selectedPresetId: presetId });
  };

  private subscribeToEvents() {
    const { metric } = this.state;

    this._subs.add(
      this.subscribeToEvent(EventApplyPanelConfig, (event) => {
        const { config, restoreDefault } = event.payload;
        const userPrefs = userPreferences.getItem(PREF_KEYS.METRIC_PREFS) || {};
        const userPrefForMetric = userPrefs[metric];

        if (restoreDefault && userPrefForMetric) {
          delete userPrefs[metric].config;
        } else {
          userPrefs[metric] = { ...userPrefForMetric, config };
        }

        userPreferences.setItem(PREF_KEYS.METRIC_PREFS, userPrefs);
      })
    );
  }

  private retrieveSelectedPreset() {
    const userPrefs = userPreferences.getItem(PREF_KEYS.METRIC_PREFS);
    const userPrefForMetric = userPrefs && userPrefs[this.state.metric];
    return userPrefForMetric ? userPrefForMetric.config : null;
  }

  private onClickRestoreDefault = () => {
    this.setState({ isConfirmModalOpen: true });
  };

  private onClickConfirmRestoreDefault = () => {
    const { metric, presets } = this.state;
    const [defaultPreset] = presets;

    if (!defaultPreset) {
      displayError(new Error(`No default config found for metric ${metric}!`), [
        'Cannot restore default configuration.',
      ]);
      return;
    }

    this.publishEvent(
      new EventApplyPanelConfig({
        metric,
        config: ConfigurePanelForm.getPanelConfigFromPreset(defaultPreset),
        restoreDefault: true,
      }),
      true
    );

    this.closeConfirmModal();
  };

  private closeConfirmModal = () => {
    this.setState({ isConfirmModalOpen: false });
  };

  private onClickCancel = () => {
    this.publishEvent(new EventCancelConfigurePanel({ metric: this.state.metric }), true);
  };

  private onClickApplyConfig = () => {
    const { metric, presets, selectedPresetId } = this.state;
    const preset = presets.find((preset) => preset.id === selectedPresetId);

    if (!preset) {
      displayError(new Error(`No config found for metric ${metric} and preset id="${selectedPresetId}"!`), [
        'Cannot apply configuration.',
      ]);
      return;
    }

    const config = ConfigurePanelForm.getPanelConfigFromPreset(preset);
    this.publishEvent(new EventApplyPanelConfig({ metric, config }), true);
  };

  private static getPanelConfigFromPreset(preset: PanelConfigPreset) {
    return omit(preset, ['name', 'panelOptions.description']) as PanelConfigPreset;
  }

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
