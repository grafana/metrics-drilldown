import { sceneGraph, sceneUtils, type SceneObject, type SceneObjectUrlValues } from '@grafana/scenes';
import { useEffect, useMemo, useState } from 'react';

import { MetricsDrilldownDataSourceVariable } from 'MetricsDrilldownDataSourceVariable';
import { MetricSelectedEvent, VAR_DATASOURCE } from 'shared';
import { PREF_KEYS } from 'UserPreferences/pref-keys';
import { userStorage } from 'UserPreferences/userStorage';
import { getTrailFor } from 'utils';
import { displayError } from 'WingmanDataTrail/helpers/displayStatus';

import { genBookmarkKey } from './genBookmarkKey';

export type Bookmark = {
  key: string;
  urlValues: SceneObjectUrlValues & { metric: string };
  createdAt: number;
};

export type BookmarkFromStorage = Omit<Bookmark, 'key'>;

export function useBookmarks(sceneObject: SceneObject) {
  const [allBookmarks, setAllBookmarks] = useState<Record<string, Bookmark>>({});
  const trail = getTrailFor(sceneObject);

  useEffect(() => {
    const bookmarksFromStorage: BookmarkFromStorage[] = userStorage.getItem(PREF_KEYS.BOOKMARKS) || [];
    const bookmarks: Record<string, Bookmark> = {};

    for (const b of bookmarksFromStorage) {
      // to store the min amount of data, we don't store the key in user storage, we compute it on-the-fly here, when it's retrieved
      const key = genBookmarkKey(b.urlValues);
      bookmarks[key] = { ...b, key };
    }

    setAllBookmarks(bookmarks);
  }, []);

  const { value: dsValue } = sceneGraph
    .findByKeyAndType(trail, VAR_DATASOURCE, MetricsDrilldownDataSourceVariable)
    .useState();

  const bookmarks = useMemo(
    () => Object.values(allBookmarks).filter((b) => b.urlValues[`var-${VAR_DATASOURCE}`] === (dsValue as string)),
    [allBookmarks, dsValue]
  );

  const addBookmark = () => {
    const newBookmark = {
      urlValues: sceneUtils.getUrlState(trail) as Bookmark['urlValues'],
      createdAt: Date.now(),
    };
    const bookmarksForStorage = Object.values(allBookmarks).map((b) => ({ ...b, key: undefined }));

    userStorage.setItem(PREF_KEYS.BOOKMARKS, [...bookmarksForStorage, newBookmark]);

    const newKey = genBookmarkKey(newBookmark.urlValues);
    setAllBookmarks({ ...allBookmarks, [newKey]: { ...newBookmark, key: newKey } });
  };

  const removeBookmark = (bookmarkKey: string) => {
    delete allBookmarks[bookmarkKey];
    const bookmarksForStorage = Object.values(allBookmarks).map((b) => ({ ...b, key: undefined }));

    userStorage.setItem(PREF_KEYS.BOOKMARKS, bookmarksForStorage);

    setAllBookmarks({ ...allBookmarks });
  };

  const gotoBookmark = (bookmarkKey: string) => {
    const bookmark = allBookmarks[bookmarkKey];
    if (!bookmark) {
      const error = new Error('Bookmark not found!');
      displayError(error, [error.toString()]);
      return;
    }

    trail.publishEvent(
      new MetricSelectedEvent({
        metric: bookmark.urlValues.metric,
        urlValues: bookmark.urlValues,
      }),
      true
    );
  };

  return { bookmarks, addBookmark, removeBookmark, gotoBookmark };
}
