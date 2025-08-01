import { urlUtil } from '@grafana/data';
import { sceneUtils, type SceneObject, type SceneObjectRef, type SceneObjectUrlValues } from '@grafana/scenes';
import { debounce, isEqual } from 'lodash';

import { createBookmarkSavedNotification } from './utils';
import { DataTrail } from '../DataTrail';
import { RECENT_TRAILS_KEY, TRAIL_BOOKMARKS_KEY } from '../shared';
import { newMetricsTrail } from '../utils';

const MAX_RECENT_TRAILS = 20;

// Added when removing history to replace serialized trail history with only URL values
export interface UrlSerializedTrail {
  urlValues: SceneObjectUrlValues;
}

// used in the migration for old history format
export interface SerializedTrail {
  history: SerializedTrailHistory[];
  currentStep?: number; // Assume last step in history if not specified
  createdAt?: number;
}

// used in the migration for old history format
export interface SerializedTrailHistory {
  urlValues: SceneObjectUrlValues;
  description: string;
}

export interface DataTrailBookmark {
  urlValues: SceneObjectUrlValues;
  createdAt: number;
}

export class TrailStore {
  private _recent: Array<SceneObjectRef<DataTrail>> = [];
  private _bookmarks: DataTrailBookmark[] = [];
  private _save: () => void;
  private _lastModified: number;

  constructor() {
    this.load();
    this._lastModified = Date.now();
    const doSave = () => {
      const serializedRecent = this._recent
        .slice(0, MAX_RECENT_TRAILS)
        .map((trail) => this._serializeTrail(trail.resolve()));
      localStorage.setItem(RECENT_TRAILS_KEY, JSON.stringify(serializedRecent));
      localStorage.setItem(TRAIL_BOOKMARKS_KEY, JSON.stringify(this._bookmarks));
      this._lastModified = Date.now();
    };

    this._save = debounce(doSave, 1000);

    window.addEventListener('beforeunload', () => {
      // Before closing or reloading the page, we want to remove the debounce from `_save` so that
      // any calls to is on event `unload` are actualized. Debouncing would cause a delay until after the page has been unloaded.
      this._save = doSave;
    });
  }

  private _loadRecentTrailsFromStorage() {
    const list: Array<SceneObjectRef<DataTrail>> = [];
    const storageItem = localStorage.getItem(RECENT_TRAILS_KEY);
    if (storageItem) {
      const serializedTrails: SerializedTrail[] = JSON.parse(storageItem);
      for (const t of serializedTrails) {
        const trail = this._deserializeTrail(t);
        list.push(trail.getRef());
      }
    }
    return list;
  }

  private _loadBookmarksFromStorage() {
    const storageItem = localStorage.getItem(TRAIL_BOOKMARKS_KEY);

    const list: Array<DataTrailBookmark | SerializedTrail> = storageItem ? JSON.parse(storageItem) : [];

    return list.map((item) => {
      if (isSerializedTrail(item)) {
        // Take the legacy SerializedTrail implementation of bookmark storage, and extract a DataTrailBookmark
        const step = item.currentStep != null ? item.currentStep : item.history.length - 1;
        const bookmark: DataTrailBookmark = {
          urlValues: item.history[step].urlValues,
          createdAt: item.createdAt || Date.now(),
        };
        return bookmark;
      }
      return item;
    });
  }

  private _deserializeTrail(t: SerializedTrail | UrlSerializedTrail): DataTrail {
    // reconstruct the trail based on the serialized history
    const trail = new DataTrail({});

    const isSerializedTrail = 'history' in t;
    const urlSerializedTrail = 'urlValues' in t;
    if (isSerializedTrail) {
      t.history.forEach((step) => {
        // will go through all steps until the last one and load the most recent one
        this._loadFromUrl(trail, step.urlValues);
      });
    } else if (urlSerializedTrail) {
      this._loadFromUrl(trail, t.urlValues);
    }
    trail.setState(sceneUtils.cloneSceneObjectState(trail.state, {}));

    return trail;
  }

  private _serializeTrail(trail: DataTrail): UrlSerializedTrail {
    const urlValues = sceneUtils.getUrlState(trail);
    return { urlValues };
  }

  public getTrailForBookmarkIndex(index: number) {
    const bookmark = this._bookmarks[index];
    if (!bookmark) {
      // Create a blank trail
      return newMetricsTrail();
    }
    return this.getTrailForBookmark(bookmark);
  }

  public getTrailForBookmark(bookmark: DataTrailBookmark) {
    const key = getBookmarkKey(bookmark);
    // Match for recent trails that have the exact same state as the current step
    for (const recent of this._recent) {
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

  private _loadFromUrl(node: SceneObject, urlValues: SceneObjectUrlValues) {
    const urlState = urlUtil.renderUrl('', urlValues);
    sceneUtils.syncStateFromSearchParams(node, new URLSearchParams(urlState));
  }

  // Recent Trails
  get recent() {
    return this._recent;
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
    const notActivated = !recentTrail.state.trailActivated;

    if (notActivated) {
      // We do not set an uninitialized trail, or a RECENT single node "start" trail
      return;
    }

    // Remove the `recentTrail` from the list if it already exists there
    this._recent = this._recent.filter((t) => t !== recentTrail.getRef());

    // Check if any existing "recent" entries have equivalent urlState to the new recentTrail
    const recentUrlState = getUrlStateForComparison(recentTrail);

    this._recent = this._recent.filter((t) => {
      // Use the current step urlValues to filter out equivalent states
      const urlState = getUrlStateForComparison(t.resolve());
      // Only keep trails with sufficiently unique urlValues on their current step
      return !isEqual(recentUrlState, urlState);
    });

    this._recent.unshift(recentTrail.getRef());
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
}

function getUrlStateForComparison(trail: DataTrail) {
  const urlState = sceneUtils.getUrlState(trail);
  // Make a few corrections
  correctUrlStateForComparison(urlState);

  return urlState;
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
    return JSON.stringify(getUrlStateForComparison(trail));
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

function isSerializedTrail(serialized: unknown): serialized is SerializedTrail {
  return serialized != null && typeof serialized === 'object' && 'history' in serialized;
}
