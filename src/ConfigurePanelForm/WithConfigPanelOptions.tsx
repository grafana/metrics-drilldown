import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { cloneDeep } from 'lodash';
import React from 'react';

import { PERCENTILES_OPTIONS } from 'GmdVizPanel/config/percentiles-options';
import { type GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';

interface WithConfigPanelOptionsState extends SceneObjectState {
  presetId: string;
  body: GmdVizPanel;
  isSelected: boolean;
  onSelect: (presetId: string) => void;
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
    this.handlePercentilesParams();
  }

  private handlePercentilesParams() {
    const queryConfig = this.state.body.state.queryConfig;

    const percentiles = new Set(queryConfig.queries?.find((q) => q.params?.percentiles)?.params?.percentiles || []);

    const options =
      percentiles.size > 0 ? PERCENTILES_OPTIONS.map((o) => ({ ...o, checked: percentiles.has(o.value) })) : [];

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

    // we have to clone queryConfig so that the body state update below triggers
    // a re-render of the body (see GmdVizPanel.subscribeToEvents())
    const newQueryConfig = cloneDeep(body.state.queryConfig);

    newQueryConfig.queries?.some((q) => {
      if (q.params?.percentiles) {
        q.params.percentiles = queryParams.options.filter((o) => o.checked).map((o) => o.value);
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
    const { body, isSelected, queryParams } = model.useState();

    return (
      <div
        className={cx(styles.container, isSelected && styles.selected)}
        onClick={!isSelected ? model.onClickPreset : undefined}
      >
        <div className={cx(styles.vizAndRadio)}>
          <body.Component model={body} />

          <div className={styles.radioContainer}>
            <Tooltip
              content={!isSelected ? 'Click to select this configuration' : 'Current configuration'}
              placement="top"
            >
              <input type="radio" name="select-config" checked={isSelected} />
            </Tooltip>
          </div>
        </div>

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
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
      flex-direction: row;
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
    vizAndRadio: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: ${theme.spacing(1.25)};
      width: 100%;
    `,
    radioContainer: css`
      display: flex;
      align-items: center;

      & [type='radio'] {
        cursor: pointer;
      }
    `,
    paramsContainer: css`
      margin: ${theme.spacing(2, 0, 0, 1)};
    `,
    param: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(1)};
      margin-bottom: ${theme.spacing(0.5)};
      font-size: 12px;
      cursor: pointer;

      & [type='checkbox'] {
        cursor: pointer;
      }
    `,
  };
}
