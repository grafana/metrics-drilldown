import { css } from '@emotion/css';
import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

export interface SettingsState extends SceneObjectState {
  key: string;
  title: string;
  description: string;
  iconName: IconName;
  disabled: boolean;
}

export class Settings extends SceneObjectBase<SettingsState> {
  constructor({
    key,
    title,
    description,
    iconName,
    disabled,
  }: {
    key: SettingsState['key'];
    title: SettingsState['title'];
    description: SettingsState['description'];
    iconName: SettingsState['iconName'];
    disabled?: SettingsState['disabled'];
  }) {
    super({
      key,
      title,
      description,
      iconName,
      disabled: disabled ?? false,
    });
  }

  public static Component = ({ model }: SceneComponentProps<Settings>) => {
    const styles = useStyles2(getStyles);
    const { title, description } = model.useState();

    return (
      <div className={styles.container}>
        <h6 className={styles.title}>
          <span>{title}</span>
          <Tooltip content={description} placement="top">
            <Icon name="info-circle" size="sm" className={styles.infoIcon} />
          </Tooltip>
        </h6>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
      overflowY: 'hidden',
    }),
    title: css({
      fontSize: '16px',
      fontWeight: theme.typography.fontWeightLight,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      paddingBottom: theme.spacing(0.5),
    }),
    infoIcon: css({
      marginLeft: theme.spacing(1),
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      position: 'relative',
      top: '-4px',
    }),
  };
}
