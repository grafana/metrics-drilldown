import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { PREF_KEYS } from 'shared/user-preferences/pref-keys';
import { userStorage } from 'shared/user-preferences/userStorage';

import { EventConfigurePanel } from './EventConfigurePanel';
import { type Metric } from '../matchers/getMetricType';

interface ConfigurePanelActionState extends SceneObjectState {
  metric: Metric;
  disabled: boolean;
  isAlreadyConfigured: boolean;
}

export class ConfigurePanelAction extends SceneObjectBase<ConfigurePanelActionState> {
  constructor({
    metric,
    disabled,
  }: {
    metric: ConfigurePanelActionState['metric'];
    disabled?: ConfigurePanelActionState['disabled'];
  }) {
    const userPrefs = userStorage.getItem(PREF_KEYS.METRIC_PREFS) || {};

    super({
      metric,
      disabled: disabled !== undefined ? disabled : false,
      isAlreadyConfigured: Boolean(userPrefs[metric.name]?.config),
    });
  }

  public onClick = () => {
    this.publishEvent(new EventConfigurePanel({ metric: this.state.metric }), true);
  };

  public static readonly Component = ({ model }: SceneComponentProps<ConfigurePanelAction>) => {
    const styles = useStyles2(getStyles);
    const { isAlreadyConfigured, disabled } = model.useState();

    const label = isAlreadyConfigured ? 'Reconfigure Prometheus function' : 'Configure Prometheus function';

    return (
      <Button
        className={cx(styles.selectButton, isAlreadyConfigured && styles.active)}
        aria-label={label}
        variant="secondary"
        size="sm"
        fill="text"
        onClick={model.onClick}
        icon="cog"
        tooltip={label}
        tooltipPlacement="top"
        disabled={disabled}
        data-testid="configure-panel"
      />
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  selectButton: css`
    padding: 0;
  `,
  active: css`
    color: ${theme.colors.text.maxContrast};
  `,
});
