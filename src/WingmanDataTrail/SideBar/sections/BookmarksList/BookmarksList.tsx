import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { useBookmarks } from 'bookmarks/useBookmarks';

import { BookmarkListItem } from './BookmarkListItem';
import { reportExploreMetrics } from '../../../../interactions';
import { SectionTitle } from '../SectionTitle';
import { type SideBarSectionState } from '../types';

interface BookmarksListState extends SideBarSectionState {}

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
  }

  public static readonly Component = ({ model }: SceneComponentProps<BookmarksList>) => {
    const styles = useStyles2(getStyles);
    const { title, description } = model.useState();
    const { bookmarks, gotoBookmark, removeBookmark } = useBookmarks(model);

    const onSelect = (bookmarkKey: string) => {
      reportExploreMetrics('exploration_started', { cause: 'bookmark_clicked' });
      gotoBookmark(bookmarkKey);
    };

    const onDelete = (bookmarkKey: string) => {
      reportExploreMetrics('bookmark_changed', { action: 'deleted' });
      removeBookmark(bookmarkKey);
    };

    return (
      <div className={styles.container}>
        <SectionTitle title={title} description={description} data-testid="bookmarks-list-sidebar" />
        {bookmarks.length > 0 ? (
          <div className={styles.bookmarksList}>
            {bookmarks.map((bookmark) => (
              <BookmarkListItem
                key={bookmark.key}
                bookmark={bookmark}
                onSelect={() => onSelect(bookmark.key)}
                onDelete={() => onDelete(bookmark.key)}
                wide={true}
                compactHeight={true}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div>No bookmarks yet for the</div>
            <div>current data source.</div>
          </div>
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
    }),
    bookmarksList: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      overflowY: 'auto',
      paddingRight: theme.spacing(1),
    }),
    emptyState: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      height: '100px',
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    }),
  };
}
