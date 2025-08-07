// TODO: FIND A BETTER WAY
export const DATASOURCE_KEY = 'datasource';
export const TRAIL_BOOKMARKS_KEY = 'bookmarks';
export const RECENT_TRAILS_KEY = 'recent-metrics';
export const TRAIL_BREAKDOWN_SORT_KEY = 'breakdown.sortby';

let localStore: Record<string, string> = {};

export const userPreferences = {
  getItem: (key: string) => {
    return key in localStore ? JSON.parse(localStore[key]) : null;
  },
  setItem: (key: string, value: any) => {
    localStore[key] = JSON.stringify(value);
  },
  clear: () => {
    localStore = {};
  },
};
