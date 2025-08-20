import { reportExploreMetrics } from 'interactions';

import pluginJson from '../plugin.json';
import { PREF_KEYS } from './pref-keys';

/**
 * Just a wrapper class over window.localStorage
 * In the future, we'd like to use Grafana's user storage API https://github.com/grafana/grafana/blob/main/packages/grafana-runtime/src/utils/userStorage.tsx
 */
class UserStorage {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  // TODO: temporary, let's wait for the new version to be in prod to remove it
  public migrate() {
    let hasMigrations = false;

    const migrations = [
      { legacyKey: 'metricsDrilldownDataSource', newKey: PREF_KEYS.DATASOURCE },
      { legacyKey: 'metrics-drilldown-recent-metrics/v1', newKey: PREF_KEYS.RECENT_METRICS },
      { legacyKey: 'grafana.trails.bookmarks', newKey: PREF_KEYS.BOOKMARKS },
      { legacyKey: 'grafana.trails.breakdown.sort.labels.by', newKey: PREF_KEYS.BREAKDOWN_SORTBY },
    ];

    for (const { legacyKey, newKey } of migrations) {
      let existingItem = localStorage.getItem(legacyKey);
      if (existingItem === null) {
        continue;
      }

      try {
        existingItem = JSON.parse(existingItem);
      } catch {}

      this.setItem(newKey, existingItem);
      localStorage.removeItem(legacyKey);

      hasMigrations = true;
    }

    if (hasMigrations) {
      reportExploreMetrics('user_preferences_migrated', {});
    }
  }

  private buildStorageKey(key: string) {
    return `${this.service}.${key}`;
  }

  getItem(key: string): any {
    const storageKey = this.buildStorageKey(key);
    const item = localStorage.getItem(storageKey);
    return item === null ? null : JSON.parse(item);
  }

  setItem(key: string, value: any): void {
    const storageKey = this.buildStorageKey(key);
    localStorage.setItem(storageKey, JSON.stringify(value));
  }

  removeItem(key: string): void {
    const storageKey = this.buildStorageKey(key);
    localStorage.removeItem(storageKey);
  }

  clear() {
    localStorage.clear();
  }
}

export const userStorage = new UserStorage(pluginJson.id);
