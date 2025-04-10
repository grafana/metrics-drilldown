import { css } from '@emotion/css';
import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { SectionTitle } from './SectionTitle';

export interface BookmarksListState extends SceneObjectState {
  key: string;
  title: string;
  description: string;
  iconName: IconName;
  disabled: boolean;
}

export class BookmarksList extends SceneObjectBase<BookmarksListState> {
  constructor({
    key,
    title,
    description,
    iconName,
    disabled,
  }: {
    key: BookmarksListState['key'];
    title: BookmarksListState['title'];
    description: BookmarksListState['description'];
    iconName: BookmarksListState['iconName'];
    disabled?: BookmarksListState['disabled'];
  }) {
    super({
      key,
      title,
      description,
      iconName,
      disabled: disabled ?? false,
    });
  }

  public static Component = ({ model }: SceneComponentProps<BookmarksList>) => {
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
