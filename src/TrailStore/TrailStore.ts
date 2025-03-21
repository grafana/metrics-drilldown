import { urlUtil } from '@grafana/data';
import { sceneUtils, type SceneObject, type SceneObjectRef, type SceneObjectUrlValues } from '@grafana/scenes';
import { debounce } from 'lodash';

import { createBookmarkSavedNotification } from './utils';
import { DataTrail } from '../DataTrail';
import { RECENT_TRAILS_KEY, TRAIL_BOOKMARKS_KEY } from '../shared';

const MAX_RECENT_TRAILS = 20;

export interface SerializedTrail {
  urlValues: SceneObjectUrlValues;
  createdAt?: number;
}

export interface DataTrailBookmark {
  urlValues: SceneObjectUrlValues;
  createdAt: number;
}

export interface RecentTrailsMap {
  [key: string]: SceneObjectRef<DataTrail>;
}

export class TrailStore {
  private _recent: RecentTrailsMap = {};
  private _bookmarks: DataTrailBookmark[] = [];
  private _save: () => void;
  private _lastModified: number;

  constructor() {
    this.load();
    this._lastModified = Date.now();
    const doSave = () => {
      const serializedRecent = Object.values(this._recent)
        .slice(0, MAX_RECENT_TRAILS)
        .map((trail) => this._serializeTrail(trail.resolve()));
      localStorage.setItem(RECENT_TRAILS_KEY, JSON.stringify(serializedRecent));

      localStorage.setItem(TRAIL_BOOKMARKS_KEY, JSON.stringify(this._bookmarks));
      this._lastModified = Date.now();
    };

    this._save = debounce(doSave, 1000);

    window.addEventListener('beforeunload', () => {
      this._save = doSave;
    });
  }

  private _loadRecentTrailsFromStorage() {
    const recentMap: RecentTrailsMap = {};
    const storageItem = localStorage.getItem(RECENT_TRAILS_KEY);

    if (storageItem) {
      const serializedTrails: SerializedTrail[] = JSON.parse(storageItem);
      for (const t of serializedTrails) {
        const trail = this._deserializeTrail(t);
        const key = getUrlStateForComparison(trail);
        recentMap[key] = trail.getRef();
      }
    }
    return recentMap;
  }

  private _loadBookmarksFromStorage() {
    const storageItem = localStorage.getItem(TRAIL_BOOKMARKS_KEY);
    const list: Array<DataTrailBookmark | SerializedTrail> = storageItem ? JSON.parse(storageItem) : [];

    return list.map((item) => {
      if ('urlValues' in item) {
        return item as DataTrailBookmark;
      }
      // Handle legacy format
      const bookmark: DataTrailBookmark = {
        urlValues: (item as SerializedTrail).urlValues,
        createdAt: (item as SerializedTrail).createdAt || Date.now(),
      };
      return bookmark;
    });
  }

  private _deserializeTrail(t: SerializedTrail): DataTrail {
    const trail = new DataTrail({ createdAt: t.createdAt });
    this._loadFromUrl(trail, t.urlValues);
    return trail;
  }

  private _serializeTrail(trail: DataTrail): SerializedTrail {
    return {
      urlValues: sceneUtils.getUrlState(trail),
      createdAt: trail.state.createdAt,
    };
  }

  private _loadFromUrl(node: SceneObject, urlValues: SceneObjectUrlValues) {
    const urlState = urlUtil.renderUrl('', urlValues);
    sceneUtils.syncStateFromSearchParams(node, new URLSearchParams(urlState));
  }

  // Recent Trails
  get recent() {
    return Object.values(this._recent);
  }

  // Last updated metric
  get lastModified() {
    return this._lastModified;
  }

  load() {
    this._recent = this._loadRecentTrailsFromStorage();
    this._bookmarks = this._loadBookmarksFromStorage();
    this._refreshBookmarkIndexMap();
    this._lastModified = Date.now();
  }

  setRecentTrail(recentTrail: DataTrail) {
    const urlState = getUrlStateForComparison(recentTrail);
    this._recent[urlState] = recentTrail.getRef();
    this._save();
  }

  // Bookmarked Trails
  get bookmarks() {
    return this._bookmarks;
  }

  addBookmark(trail: DataTrail) {
    const urlState = sceneUtils.getUrlState(trail);

    const bookmarkState: DataTrailBookmark = {
      urlValues: urlState,
      createdAt: Date.now(),
    };

    this._bookmarks.unshift(bookmarkState);
    this._refreshBookmarkIndexMap();
    this._save();
    createBookmarkSavedNotification();
  }

  removeBookmark(index: number) {
    if (index < this._bookmarks.length) {
      this._bookmarks.splice(index, 1);
      this._refreshBookmarkIndexMap();
      this._save();
    }
  }

  getBookmarkIndex(trail: DataTrail) {
    const bookmarkKey = getBookmarkKey(trail);
    const bookmarkIndex = this._bookmarkIndexMap.get(bookmarkKey);
    return bookmarkIndex;
  }

  private _bookmarkIndexMap = new Map<string, number>();

  private _refreshBookmarkIndexMap() {
    this._bookmarkIndexMap.clear();
    this._bookmarks.forEach((bookmarked, index) => {
      const key = getBookmarkKey(bookmarked);
      // If there are duplicate bookmarks, the latest index will be kept
      this._bookmarkIndexMap.set(key, index);
    });
  }

  public getTrailForBookmarkIndex(index: number) {
    const bookmark = this._bookmarks[index];
    if (!bookmark) {
      // Create a blank trail
      const trail = new DataTrail({});
      return trail;
    }
    return this.getTrailForBookmark(bookmark);
  }

  public getTrailForBookmark(bookmark: DataTrailBookmark) {
    const key = getBookmarkKey(bookmark);
    // Match for recent trails that have the exact same state as the current step
    for (const recent of Object.values(this._recent)) {
      const trail = recent.resolve();
      if (getBookmarkKey(trail) === key) {
        return trail;
      }
    }
    // Just create a new trail with that state
    const trail = new DataTrail({});
    this._loadFromUrl(trail, bookmark.urlValues);
    return trail;
  }
}

function getUrlStateForComparison(trail: DataTrail) {
  const urlState = sceneUtils.getUrlState(trail);
  // Make a few corrections
  correctUrlStateForComparison(urlState);

  return JSON.stringify(urlState);
}

function correctUrlStateForComparison(urlState: SceneObjectUrlValues) {
  // Omit some URL parameters that are not useful for state comparison,
  // as they can change in the URL without creating new steps
  delete urlState.actionView;
  delete urlState.layout;
  delete urlState.metricSearch;
  delete urlState.refresh;

  // Populate defaults
  if (urlState['var-groupby'] === '' || urlState['var-groupby'] === undefined) {
    urlState['var-groupby'] = '$__all';
  }

  if (typeof urlState['var-filters'] !== 'string') {
    urlState['var-filters'] = urlState['var-filters']?.filter((filter) => filter !== '');
  }

  return urlState;
}

export function getBookmarkKey(trail: DataTrail | DataTrailBookmark) {
  if (trail instanceof DataTrail) {
    const urlState = sceneUtils.getUrlState(trail);
    return JSON.stringify(correctUrlStateForComparison({ ...urlState }));
  }
  return JSON.stringify(correctUrlStateForComparison({ ...trail.urlValues }));
}

let store: TrailStore | undefined;
export function getTrailStore(): TrailStore {
  if (!store) {
    store = new TrailStore();
  }

  return store;
}
