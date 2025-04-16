import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { SectionTitle } from './SectionTitle';
import { type SideBarSectionState } from './types';
import { DataTrailCard } from '../../../DataTrailCard';
import { getBookmarkKey, getTrailStore } from '../../../TrailStore/TrailStore';

export interface BookmarksListState extends SideBarSectionState {}

export class BookmarksList extends SceneObjectBase<BookmarksListState> {
  constructor({
    key,
    title,
    description,
    icon,
    disabled,
  }: {
    key: BookmarksListState['key'];
    title: BookmarksListState['title'];
    description: BookmarksListState['description'];
    icon: BookmarksListState['icon'];
    disabled?: BookmarksListState['disabled'];
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

  public static Component = ({ model }: SceneComponentProps<BookmarksList>) => {
    const styles = useStyles2(getStyles);
    const { title, description } = model.useState();
    const { bookmarks } = getTrailStore();

    const onSelect = (index: number) => {
      const bookmark = bookmarks[index];
      if (bookmark) {
        const trail = getTrailStore().getTrailForBookmark(bookmark);
        if (trail) {
          // Navigate to the trail
          const urlState = trail.getUrlState();
          const params = new URLSearchParams();

          // Convert SceneObjectUrlValues to URLSearchParams
          Object.entries(urlState).forEach(([key, value]) => {
            if (value !== undefined) {
              params.append(key, String(value));
            }
          });

          window.location.href = window.location.pathname + '?' + params.toString();
        }
      }
    };

    const onDelete = (index: number) => {
      getTrailStore().removeBookmark(index);
    };

    return (
      <div className={styles.container}>
        <SectionTitle title={title} description={description} />
        {bookmarks.length > 0 ? (
          <div className={styles.bookmarksList}>
            {bookmarks.map((bookmark, index) => (
              <DataTrailCard
                key={getBookmarkKey(bookmark)}
                bookmark={bookmark}
                onSelect={() => onSelect(index)}
                onDelete={() => onDelete(index)}
                wide={true}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>No bookmarks yet</div>
        )}
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
    bookmarksList: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      overflowY: 'auto',
      paddingRight: theme.spacing(1),
    }),
    emptyState: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100px',
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    }),
  };
}
