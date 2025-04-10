import { css } from '@emotion/css';
import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { SectionTitle } from './SectionTitle';

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
        <SectionTitle title={title} description={description} />
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
  };
}
