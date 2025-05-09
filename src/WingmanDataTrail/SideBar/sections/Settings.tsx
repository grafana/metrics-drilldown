import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { SectionTitle } from './SectionTitle';
import { type SideBarSectionState } from './types';

export interface SettingsState extends SideBarSectionState {}

export class Settings extends SceneObjectBase<SettingsState> {
  constructor({
    key,
    title,
    description,
    icon,
    disabled,
  }: {
    key: SettingsState['key'];
    title: SettingsState['title'];
    description: SettingsState['description'];
    icon: SettingsState['icon'];
    disabled?: SettingsState['disabled'];
  }) {
    super({
      key,
      title,
      description,
      icon,
      disabled: disabled ?? false,
      active: false,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {}

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
