import { logger } from 'tracking/logger/logger';

import { id as pluginId } from './plugin.json';

export const DATASOURCE_KEY = 'datasource';
export const TRAIL_BOOKMARKS_KEY = 'bookmarks';
export const RECENT_TRAILS_KEY = 'recent-metrics';
export const TRAIL_BREAKDOWN_SORT_KEY = 'breakdown.sortby';

class UserPreferences {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  // TODO: temporary, let's wait for the new version to be in prod to remove it
  public migrate() {
    const migrations = [
      { legacyKey: 'metricsDrilldownDataSource', newKey: DATASOURCE_KEY },
      { legacyKey: 'metrics-drilldown-recent-metrics/v1', newKey: RECENT_TRAILS_KEY },
      { legacyKey: 'grafana.trails.bookmarks', newKey: TRAIL_BOOKMARKS_KEY },
      { legacyKey: 'grafana.trails.breakdown.sort.labels.by', newKey: TRAIL_BREAKDOWN_SORT_KEY },
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

export const userPreferences = new UserPreferences(pluginId);

try {
  userPreferences.migrate();
} catch (error) {
  logger.error(error as Error, { cause: 'User preferences migration' });
}
