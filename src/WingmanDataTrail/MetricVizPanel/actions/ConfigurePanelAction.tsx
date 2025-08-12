import { css } from '@emotion/css';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { reportExploreMetrics } from 'interactions';

import { EventConfigurePanel } from './EventConfigurePanel';

interface ConfigurePanelActionState extends SceneObjectState {
  metric: string;
  disabled: boolean;
}

export class ConfigurePanelAction extends SceneObjectBase<ConfigurePanelActionState> {
  constructor({
    metric,
    disabled,
  }: {
    metric: ConfigurePanelActionState['metric'];
    disabled?: ConfigurePanelActionState['disabled'];
  }) {
    super({
      metric,
      disabled: disabled !== undefined ? disabled : false,
    });
  }

  public onClick = () => {
    reportExploreMetrics('configure_panel_clicked', {});
    this.publishEvent(new EventConfigurePanel({ metric: this.state.metric }), true);
  };

  public static readonly Component = ({ model }: SceneComponentProps<ConfigurePanelAction>) => {
    const styles = useStyles2(getStyles);
    const { disabled } = model.useState();

    return (
      <Button
        className={styles.selectButton}
        aria-label="Configure panel"
        variant="secondary"
        size="sm"
        fill="text"
        onClick={model.onClick}
        icon="cog"
        tooltip="Configure panel"
        tooltipPlacement="top"
        disabled={disabled}
      />
    );
  };
}

const getStyles = () => ({
  selectButton: css`
    margin: 0;
    padding: 0;
  `,
});
