import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, sceneUtils, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import React from 'react';

import { genBookmarkKey } from '../../bookmarks/genBookmarkKey';
import { notifyBookmarkCreated } from '../../bookmarks/notifyBookmarkCreated';
import { reportExploreMetrics } from '../../interactions';
import { PREF_KEYS } from '../../UserPreferences/pref-keys';
import { userStorage } from '../../UserPreferences/userStorage';
import { getTrailFor } from '../../utils';
import { BookmarkFromStorage } from 'bookmarks/useBookmarks';

interface BookmarkHeaderActionState extends SceneObjectState {
  metric: string;
  isBookmarked: boolean;
}

export class BookmarkHeaderAction extends SceneObjectBase<BookmarkHeaderActionState> {
  constructor({
    metric,
  }: {
    metric: BookmarkHeaderActionState['metric'];
  }) {
    super({
      metric,
      isBookmarked: false,
    });

    // Update bookmark state when component activates
    this.addActivationHandler(() => {
      const actualBookmarkState = this.isCurrentStateBookmarked();
      this.setState({ isBookmarked: actualBookmarkState });
    });
  }

  private isCurrentStateBookmarked(): boolean {
    try {
      const trail = getTrailFor(this);
      const currentUrlState = sceneUtils.getUrlState(trail);
      const currentKey = genBookmarkKey(currentUrlState);
      const bookmarksFromStorage = userStorage.getItem(PREF_KEYS.BOOKMARKS) || [];
      return bookmarksFromStorage.some((b: BookmarkFromStorage) => genBookmarkKey(b.urlValues) === currentKey);
    } catch {
      return false;
    }
  }

  public onClick = () => {
    const trail = getTrailFor(this);
    const currentUrlState = sceneUtils.getUrlState(trail);
    const currentKey = genBookmarkKey(currentUrlState);
    const bookmarksFromStorage = userStorage.getItem(PREF_KEYS.BOOKMARKS) || [];
    const isCurrentlyBookmarked = bookmarksFromStorage.some((b: BookmarkFromStorage) => genBookmarkKey(b.urlValues) === currentKey);

    if (isCurrentlyBookmarked) {
      // Remove bookmark
      reportExploreMetrics('bookmark_changed', { action: 'toggled_off' });
      const updatedBookmarks = bookmarksFromStorage.filter((b: BookmarkFromStorage) => genBookmarkKey(b.urlValues) !== currentKey);
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
    
    // Update state to trigger re-render
    this.setState({ isBookmarked: !isCurrentlyBookmarked });
  };

  public static readonly Component = ({ model }: SceneComponentProps<BookmarkHeaderAction>) => {
    const styles = useStyles2(getStyles);
    const { isBookmarked } = model.useState();

    const label = isBookmarked ? 'Remove bookmark' : 'Add bookmark';

    return (
      <Button
        className={cx(styles.bookmarkButton, isBookmarked && styles.active)}
        aria-label={label}
        variant="secondary"
        size="sm"
        fill="text"
        onClick={model.onClick}
        icon={
          isBookmarked ? (
            <Icon name={'favorite'} type={'mono'} size={'lg'} />
          ) : (
            <Icon name={'star'} type={'default'} size={'lg'} />
          )
        }
        tooltip={label}
        tooltipPlacement="top"
        data-testid="bookmark-header-action"
      />
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  bookmarkButton: css`
    margin: 0;
    padding: 0;
    margin-left: ${theme.spacing(1)};
  `,
  active: css`
    color: ${theme.colors.text.maxContrast};
  `,
});
