import { css } from '@emotion/css';
import { SceneObjectBase, sceneUtils, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

import { genBookmarkKey } from '../../bookmarks/genBookmarkKey';
import { notifyBookmarkCreated } from '../../bookmarks/notifyBookmarkCreated';
import { reportExploreMetrics } from '../../interactions';
import { PREF_KEYS } from '../../UserPreferences/pref-keys';
import { userStorage } from '../../UserPreferences/userStorage';
import { getTrailFor } from '../../utils';

interface BookmarkHeaderActionState extends SceneObjectState {
  metric: string;
}

export class BookmarkHeaderAction extends SceneObjectBase<BookmarkHeaderActionState> {
  constructor({
    metric,
  }: {
    metric: BookmarkHeaderActionState['metric'];
  }) {
    super({
      metric,
    });
  }

  private isCurrentStateBookmarked(): boolean {
    try {
      const trail = getTrailFor(this);
      const currentUrlState = sceneUtils.getUrlState(trail);
      const currentKey = genBookmarkKey(currentUrlState);
      const bookmarksFromStorage = userStorage.getItem(PREF_KEYS.BOOKMARKS) || [];
      return bookmarksFromStorage.some((b: any) => genBookmarkKey(b.urlValues) === currentKey);
    } catch {
      return false;
    }
  }

  public onClick = () => {
    const trail = getTrailFor(this);
    const currentUrlState = sceneUtils.getUrlState(trail);
    const currentKey = genBookmarkKey(currentUrlState);
    const bookmarksFromStorage = userStorage.getItem(PREF_KEYS.BOOKMARKS) || [];
    const isCurrentlyBookmarked = bookmarksFromStorage.some((b: any) => genBookmarkKey(b.urlValues) === currentKey);

    if (isCurrentlyBookmarked) {
      // Remove bookmark
      reportExploreMetrics('bookmark_changed', { action: 'toggled_off' });
      const updatedBookmarks = bookmarksFromStorage.filter((b: any) => genBookmarkKey(b.urlValues) !== currentKey);
      userStorage.setItem(PREF_KEYS.BOOKMARKS, updatedBookmarks);
    } else {
      // Add bookmark
      reportExploreMetrics('bookmark_changed', { action: 'toggled_on' });
      const newBookmark = {
        urlValues: currentUrlState,
        createdAt: Date.now(),
      };
      userStorage.setItem(PREF_KEYS.BOOKMARKS, [...bookmarksFromStorage, newBookmark]);
      notifyBookmarkCreated();
    }
    
    // Force re-render to update the icon
    this.forceRender();
  };

  public static readonly Component = ({ model }: SceneComponentProps<BookmarkHeaderAction>) => {
    const styles = useStyles2(getStyles);
    const isBookmarked = model.isCurrentStateBookmarked();

    const label = isBookmarked ? 'Remove bookmark' : 'Add bookmark';
    const icon = isBookmarked ? 'favorite' : 'star';

    return (
      <Button
        className={styles.bookmarkButton}
        aria-label={label}
        variant="secondary"
        size="sm"
        fill="text"
        onClick={model.onClick}
        icon={icon}
        tooltip={label}
        tooltipPlacement="top"
        data-testid="bookmark-header-action"
      />
    );
  };
}

const getStyles = () => ({
  bookmarkButton: css`
    margin: 0;
    padding: 0;
  `,
});
