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
    return false;
  }
}

export class BookmarkAction {
  // `onToggled` lets the caller rebuild the menu's items immediately, so the label flips from
  // "Add bookmark" to "Remove bookmark" (and back) without the user having to close and reopen
  // the menu. PanelMenuItem is a plain snapshot object, it has no state of its own to react to.
  static create(panelMenuInstance: SceneObject, onToggled: () => void): PanelMenuItem {
    const isBookmarked = isCurrentStateBookmarked(panelMenuInstance);

    return {
      text: isBookmarked
        ? t('panel-menu.action.remove-bookmark', 'Remove bookmark')
        : t('panel-menu.action.add-bookmark', 'Add bookmark'),
      iconClassName: isBookmarked ? 'favorite' : 'star',
      onClick: () => {
        // Re-checked here rather than reusing the `isBookmarked` captured above: the menu can stay
        // open (or get clicked from a stale build) across a metric/filter/time-range change that
        // doesn't rebuild items, so the value this item was built with can be stale by click time.
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
