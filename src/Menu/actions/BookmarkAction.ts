import { type PanelMenuItem } from '@grafana/data';
import { sceneUtils } from '@grafana/scenes';

import { genBookmarkKey } from '../../bookmarks/genBookmarkKey';
import { notifyBookmarkCreated } from '../../bookmarks/notifyBookmarkCreated';
import { type DataTrail } from '../../DataTrail';
import { reportExploreMetrics } from '../../interactions';
import { PREF_KEYS } from '../../UserPreferences/pref-keys';
import { userStorage } from '../../UserPreferences/userStorage';

export class BookmarkAction {
  static create(trail: DataTrail): PanelMenuItem {
    // Get bookmark state without hooks - simplified version without datasource filtering
    const currentUrlState = sceneUtils.getUrlState(trail);
    const currentKey = genBookmarkKey(currentUrlState);
    const bookmarksFromStorage = userStorage.getItem(PREF_KEYS.BOOKMARKS) || [];
    const isBookmarked = bookmarksFromStorage.some((b: any) => genBookmarkKey(b.urlValues) === currentKey);

    return {
      text: isBookmarked ? 'Remove bookmark' : 'Add bookmark',
      iconClassName: isBookmarked ? 'favorite' : 'star',
      onClick: () => {
        if (isBookmarked) {
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
      },
    };
  }
}
