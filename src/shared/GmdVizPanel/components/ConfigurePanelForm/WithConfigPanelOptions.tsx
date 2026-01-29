import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { cloneDeep } from 'lodash';
import React from 'react';

import { AVAILABLE_PERCENTILES_OPTIONS } from 'shared/GmdVizPanel/config/percentiles-options';
import { type ConfigPresetId } from 'shared/GmdVizPanel/config/presets/types';
import { type GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';

interface WithConfigPanelOptionsState extends SceneObjectState {
  presetId: ConfigPresetId;
  body: GmdVizPanel;
  isSelected: boolean;
  onSelect: (presetId: ConfigPresetId) => void;
  // currently, only percentiles are handheld by the app
  // in the future, if we add more parameters, this code will have to be more generic
  queryParams: {
    show: boolean;
    options: Array<{ value: any; label: string; checked: boolean }>;
    type?: 'percentiles';
  };
}

export class WithConfigPanelOptions extends SceneObjectBase<WithConfigPanelOptionsState> {
  constructor({
    body,
    presetId,
    isSelected,
    onSelect,
  }: {
    body: WithConfigPanelOptionsState['body'];
    presetId: WithConfigPanelOptionsState['presetId'];
    isSelected: WithConfigPanelOptionsState['isSelected'];
    onSelect: WithConfigPanelOptionsState['onSelect'];
  }) {
    super({
      presetId,
      body,
      isSelected,
      onSelect,
      queryParams: {
        show: false,
        options: [],
      },
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.initPercentilesParams();
  }

  private initPercentilesParams() {
    const queryConfig = this.state.body.state.queryConfig;

    const percentiles = new Set(queryConfig.queries?.find((q) => q.params?.percentiles)?.params?.percentiles || []);

    const options =
      percentiles.size > 0
        ? AVAILABLE_PERCENTILES_OPTIONS.map((o) => ({ ...o, checked: percentiles.has(o.value) }))
        : [];

    this.setState({
      queryParams: {
        show: options.length > 0,
        options,
      },
    });
  }

  private onTogglePercentile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { queryParams, body } = this.state;
    const value = Number(event.target.value);

    const option = queryParams.options.find((o) => o.value === value);
    if (!option) {
      return;
    }

    // update in situ, for simplicity (so we don't have to clone queryParams)
    option.checked = !option.checked;

    const checkedOptions = queryParams.options.filter((o) => o.checked);
    if (!checkedOptions.length) {
      return; // prevent invalid config
    }

    // we have to clone queryConfig so that the body state update below triggers
    // a re-render of the panel (see GmdVizPanel.subscribeToEvents())
    const newQueryConfig = cloneDeep(body.state.queryConfig);

    newQueryConfig.queries?.some((q) => {
      if (q.params?.percentiles) {
        q.params.percentiles = checkedOptions.map((o) => o.value);
        return true;
      }
      return false;
    });

    body.update({}, newQueryConfig);

    this.setState({ queryParams });
  };

  private onClickPreset = () => {
    this.state.onSelect(this.state.presetId);
  };

  public static readonly Component = ({ model }: SceneComponentProps<WithConfigPanelOptions>) => {
    const styles = useStyles2(getStyles);
    const { body, isSelected, presetId, queryParams } = model.useState();
    const radioLabel = body.state.panelConfig?.title ?? presetId;

    const isClickable = !isSelected;
    const handleKeyDown = isClickable
      ? (event: React.KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            model.onClickPreset();
          }
        }
      : undefined;

    return (
      <div
        className={cx(styles.container, isSelected && styles.selected)}
        onClick={isClickable ? model.onClickPreset : undefined}
        onKeyDown={handleKeyDown}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
      >
        <div className={cx(styles.bodyAndParams)}>
          <body.Component model={body} />

          {queryParams.show && (
            <div className={styles.paramsContainer}>
              {queryParams.options.map((o) => (
                <label key={o.value} className={cx('param', styles.param)} htmlFor={`checkbox-${o.value}`}>
                  <input
                    id={`checkbox-${o.value}`}
                    type="checkbox"
                    value={o.value}
                    checked={o.checked}
                    onChange={model.onTogglePercentile}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className={styles.radioContainer}>
          <Tooltip
            content={
              !isSelected
                ? t('with-config-panel-options.click-to-select', 'Click to select this configuration')
                : t('with-config-panel-options.current-config', 'Current configuration')
            }
            placement="top"
          >
            <input
              type="radio"
              name="select-config"
              checked={isSelected}
              aria-label={radioLabel}
            />
          </Tooltip>
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
      padding: ${theme.spacing(1, 1, 1.25, 1)};
      border: 1px solid transparent;
      transition: all 0.2s ease-in-out;

      &:hover {
        border: 1px solid ${theme.colors.border.weak};
        border-color: ${theme.colors.primary.border};
      }
      &:focus {
        border: 1px solid ${theme.colors.border.weak};
        outline: 1px solid ${theme.colors.primary.main};
        outline-offset: 1px;
      }
    `,
    selected: css`
      cursor: default;
      border: 1px solid ${theme.colors.border.weak};
      border-color: ${theme.colors.primary.border};
    `,
    bodyAndParams: css`
      display: flex;
      flex-direction: row;
      gap: ${theme.spacing(1.25)};
      width: 100%;
    `,
    paramsContainer: css`
      margin-top: ${theme.spacing(1)};
    `,
    param: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(0.5)};
      margin-bottom: ${theme.spacing(0.5)};
      font-size: 12px;
      cursor: pointer;

      & [type='checkbox'] {
        cursor: pointer;
      }
    `,
    radioContainer: css`
      display: flex;
      align-items: center;
      justify-content: center;

      & [type='radio'] {
        cursor: pointer;
      }
    `,
  };
}
