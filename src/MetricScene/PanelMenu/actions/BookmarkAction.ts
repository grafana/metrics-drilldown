import { type PanelMenuItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneUtils, type SceneObject } from '@grafana/scenes';

import { genBookmarkKey } from '../../../shared/bookmarks/genBookmarkKey';
import { type BookmarkFromStorage } from '../../../shared/bookmarks/useBookmarks';
import { reportExploreMetrics } from '../../../shared/tracking/interactions';
import { PREF_KEYS } from '../../../shared/user-preferences/pref-keys';
import { userStorage } from '../../../shared/user-preferences/userStorage';
import { getTrailFor } from '../../../shared/utils/utils';

export function isCurrentStateBookmarked(panelMenuInstance: SceneObject): boolean {
  try {
    const trail = getTrailFor(panelMenuInstance);
    const currentUrlState = sceneUtils.getUrlState(trail);
    const currentKey = genBookmarkKey(currentUrlState);
    const bookmarksFromStorage = userStorage.getItem(PREF_KEYS.BOOKMARKS) || [];
    return bookmarksFromStorage.some((b: BookmarkFromStorage) => genBookmarkKey(b.urlValues) === currentKey);
  } catch {
    // Trail or URL state unavailable; treat as not bookmarked rather than throwing.
    return false;
  }
}

export class BookmarkAction {
  // `onToggled` rebuilds the menu immediately so the label flips without closing and reopening
  // it; PanelMenuItem is a static snapshot with no state of its own to react to otherwise.
  static create(panelMenuInstance: SceneObject, onToggled: () => void): PanelMenuItem {
    const isBookmarked = isCurrentStateBookmarked(panelMenuInstance);

    return {
      text: isBookmarked
        ? t('panel-menu.action.remove-bookmark', 'Remove bookmark')
        : t('panel-menu.action.add-bookmark', 'Add bookmark'),
      iconClassName: isBookmarked ? 'favorite' : 'star',
      onClick: () => {
        // Re-checked rather than reusing `isBookmarked` above: the menu can go stale between
        // build and click (a filter or metric change doesn't always trigger a rebuild).
        const isCurrentlyBookmarked = isCurrentStateBookmarked(panelMenuInstance);

        const trail = getTrailFor(panelMenuInstance);
        const currentUrlState = sceneUtils.getUrlState(trail);
        const currentKey = genBookmarkKey(currentUrlState);
        const bookmarksFromStorage = userStorage.getItem(PREF_KEYS.BOOKMARKS) || [];

        if (isCurrentlyBookmarked) {
          reportExploreMetrics('bookmark_changed', { action: 'toggled_off' });
          const updatedBookmarks = bookmarksFromStorage.filter(
            (b: BookmarkFromStorage) => genBookmarkKey(b.urlValues) !== currentKey
          );
          userStorage.setItem(PREF_KEYS.BOOKMARKS, updatedBookmarks);
        } else {
          reportExploreMetrics('bookmark_changed', { action: 'toggled_on' });
          const newBookmark = {
            urlValues: currentUrlState,
            createdAt: Date.now(),
          };
          userStorage.setItem(PREF_KEYS.BOOKMARKS, [...bookmarksFromStorage, newBookmark]);
        }

        onToggled();
      },
    };
  }
}
