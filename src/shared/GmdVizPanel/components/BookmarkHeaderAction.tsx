import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, sceneUtils, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import React from 'react';

import { genBookmarkKey } from 'shared/bookmarks/genBookmarkKey';
import { type BookmarkFromStorage } from 'shared/bookmarks/useBookmarks';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { PREF_KEYS } from 'shared/user-preferences/pref-keys';
import { userStorage } from 'shared/user-preferences/userStorage';
import { getTrailFor } from 'shared/utils/utils';

interface BookmarkHeaderActionState extends SceneObjectState {
  isBookmarked: boolean;
}

export class BookmarkHeaderAction extends SceneObjectBase<BookmarkHeaderActionState> {
  constructor() {
    super({
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
    const currentUrlState = sceneUtils.getUrlState(getTrailFor(this));
    const currentKey = genBookmarkKey(currentUrlState);
    const bookmarksFromStorage = userStorage.getItem(PREF_KEYS.BOOKMARKS) || [];
    const isCurrentlyBookmarked = this.state.isBookmarked;

    if (isCurrentlyBookmarked) {
      // Remove bookmark
      reportExploreMetrics('bookmark_changed', { action: 'toggled_off' });
      const updatedBookmarks = bookmarksFromStorage.filter(
        (b: BookmarkFromStorage) => genBookmarkKey(b.urlValues) !== currentKey
      );
      userStorage.setItem(PREF_KEYS.BOOKMARKS, updatedBookmarks);
    } else {
      // Add bookmark
      reportExploreMetrics('bookmark_changed', { action: 'toggled_on' });
      const newBookmark = {
        urlValues: currentUrlState,
        createdAt: Date.now(),
      };
      userStorage.setItem(PREF_KEYS.BOOKMARKS, [...bookmarksFromStorage, newBookmark]);
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
    padding: 0;
    margin-left: ${theme.spacing(1)};
  `,
  active: css`
    color: ${theme.colors.text.maxContrast};
  `,
});
