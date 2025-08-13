import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { type GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';

interface WithConfigPanelOptionsState extends SceneObjectState {
  presetId: string;
  body: GmdVizPanel;
  isSelected: boolean;
  onSelect: (presetId: string) => void;
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
    });
  }

  private onSelectPreset = () => {
    this.state.onSelect(this.state.presetId);
  };

  public static readonly Component = ({ model }: SceneComponentProps<WithConfigPanelOptions>) => {
    const styles = useStyles2(getStyles);
    const { body, isSelected } = model.useState();

    return (
      <Tooltip content={!isSelected ? 'Click to select this configuration' : 'Selected configuration'}>
        <div
          className={cx(styles.container, isSelected && styles.selected)}
          onClick={!isSelected ? model.onSelectPreset : undefined}
        >
          <body.Component model={body} />
        </div>
      </Tooltip>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;
      gap: ${theme.spacing(1)};
      align-items: middle;
      padding: ${theme.spacing(1, 1, 1.25, 1)};
      border: 1px solid transparent;
      cursor: pointer;
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
  };
}
