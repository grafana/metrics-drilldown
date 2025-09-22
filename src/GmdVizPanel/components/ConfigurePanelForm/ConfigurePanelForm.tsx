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
import { cloneDeep, omit } from 'lodash';
import React from 'react';

import { DataTrail } from 'AppDataTrail/DataTrail';
import { getPreferredConfigForMetric } from 'GmdVizPanel/config/getPreferredConfigForMetric';
import { PANEL_HEIGHT } from 'GmdVizPanel/config/panel-heights';
import { getConfigPresetsForMetric } from 'GmdVizPanel/config/presets/getConfigPresetsForMetric';
import { type PanelConfigPreset } from 'GmdVizPanel/config/presets/types';
import { GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';
import { displayError } from 'MetricsReducer/helpers/displayStatus';
import { GRID_TEMPLATE_COLUMNS } from 'MetricsReducer/MetricsList/MetricsList';
import { PREF_KEYS } from 'UserPreferences/pref-keys';
import { userStorage } from 'UserPreferences/userStorage';
import { getTrailFor } from 'utils';

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

  private async buildBody() {
    const { metric } = this.state;
    const prefConfig = getPreferredConfigForMetric(metric);
    const presets = await getConfigPresetsForMetric(metric, getTrailFor(this));

    // if not found in the user preferences, we use the first preset
    // it always works because the presets are organized to always have the default one as the first element (see GmdVizPanel/config/presets)
    const selectedPresetId = (prefConfig || presets[0]).id;

    const body = new SceneCSSGridLayout({
      templateColumns: GRID_TEMPLATE_COLUMNS,
      autoRows: PANEL_HEIGHT.M + 46, // see css in WithConfigPanelOptions
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
              key: `panel-${option.id}`,
              // we make sure that, if the user has previously configured some query parameters (like percentiles),
              // they are applied here
              discardUserPrefs: option.id !== prefConfig?.id,
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

    this.subscribeToEvent(EventApplyPanelConfig, (event) => {
      const { config, restoreDefault } = event.payload;
      const userPrefs = userStorage.getItem(PREF_KEYS.METRIC_PREFS) || {};
      const userPrefForMetric = userPrefs[metric];

      if (restoreDefault && userPrefForMetric) {
        delete userPrefs[metric].config;
      } else {
        userPrefs[metric] = { ...userPrefForMetric, config };
      }

      userStorage.setItem(PREF_KEYS.METRIC_PREFS, userPrefs);
    });
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

    const presetPanel = sceneGraph.findByKeyAndType(this, `panel-${selectedPresetId}`, GmdVizPanel);
    if (!presetPanel) {
      throw new Error(`Panel not found for preset id="${selectedPresetId}"!`);
    }

    const preset = presets.find((preset) => preset.id === selectedPresetId);
    if (!preset) {
      throw new Error(`Preset with id="${selectedPresetId}" not found!`);
    }

    // we clone the preset to update its queries property to
    // ensure that some customized parameters (like percentiles) are properly applied
    const presetWithQueryParams: PanelConfigPreset = cloneDeep(preset);
    presetWithQueryParams.queryOptions.queries = presetPanel.state.queryConfig.queries;

    this.publishEvent(
      new EventApplyPanelConfig({
        metric,
        config: ConfigurePanelForm.getPanelConfigFromPreset(presetWithQueryParams),
      }),
      true
    );
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
          body={`Are you sure you want to restore the default configuration for the ${metric} metric?`}
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
      position: sticky;
      bottom: 0;
      background: ${theme.colors.background.primary};
      padding: ${theme.spacing(2, 0)};
      border-top: 1px solid ${theme.colors.border.weak};
    `,
  };
}
