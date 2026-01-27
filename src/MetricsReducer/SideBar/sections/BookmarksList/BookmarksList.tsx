import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneObjectBase, type SceneComponentProps } from '@grafana/scenes';
import { Stack, Text, useStyles2 } from '@grafana/ui';
import React from 'react';

import { useBookmarks } from 'shared/bookmarks/useBookmarks';

import { BookmarkListItem } from './BookmarkListItem';
import { reportExploreMetrics } from '../../../../shared/tracking/interactions';
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
      <Stack direction="column" gap={1} height="100%">
        <SectionTitle title={title} description={description} data-testid="bookmarks-list-sidebar" />
        {bookmarks.length > 0 ? (
          <div className={styles.bookmarksList}>
            <Stack direction="column" gap={1.5}>
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
            </Stack>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Stack direction="column" alignItems="center">
              <Text color="secondary" italic>
                <Trans i18nKey="sidebar.bookmarks.empty-state">
                  No bookmarks yet for the
                  <br />
                  current data source.
                </Trans>
              </Text>
            </Stack>
          </div>
        )}
      </Stack>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    bookmarksList: css({
      overflowY: 'auto',
      paddingRight: theme.spacing(1),
    }),
    emptyState: css({
      height: '100px',
    }),
  };
}
