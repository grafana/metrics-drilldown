import { sceneGraph, sceneUtils, type SceneObject, type SceneObjectUrlValues } from '@grafana/scenes';
import { useEffect, useMemo, useState } from 'react';

import { MetricsDrilldownDataSourceVariable } from 'AppDataTrail/MetricsDrilldownDataSourceVariable';
import { displayError } from 'MetricsReducer/helpers/displayStatus';
import { recordMetricBookmark } from 'MetricsReducer/list-controls/JevSort/personalization';
import { MetricSelectedEvent, VAR_DATASOURCE } from 'shared/shared';
import { getTrailFor } from 'shared/utils/utils';

import { genBookmarkKey } from './genBookmarkKey';
import { PREF_KEYS } from '../user-preferences/pref-keys';
import { userStorage } from '../user-preferences/userStorage';

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
    const datasourceUid = newBookmark.urlValues[`var-${VAR_DATASOURCE}`];
    if (typeof datasourceUid === 'string') {
      recordMetricBookmark(datasourceUid, newBookmark.urlValues.metric, newBookmark.createdAt, true);
    }

    const newKey = genBookmarkKey(newBookmark.urlValues);
    setAllBookmarks({ ...allBookmarks, [newKey]: { ...newBookmark, key: newKey } });
  };

  const removeBookmark = (bookmarkKey: string) => {
    const bookmark = allBookmarks[bookmarkKey];
    delete allBookmarks[bookmarkKey];
    const bookmarksForStorage = Object.values(allBookmarks).map((b) => ({ ...b, key: undefined }));

    userStorage.setItem(PREF_KEYS.BOOKMARKS, bookmarksForStorage);
    const datasourceUid = bookmark?.urlValues[`var-${VAR_DATASOURCE}`];
    if (typeof datasourceUid === 'string') {
      recordMetricBookmark(datasourceUid, bookmark.urlValues.metric, bookmark.createdAt, false);
    }

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
