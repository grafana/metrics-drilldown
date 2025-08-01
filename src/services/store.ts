import { TRAIL_BREAKDOWN_SORT_KEY, TRAIL_BREAKDOWN_VIEW_KEY } from '../shared';
import { type SortSeriesByOption } from './sorting';

export function getVewByPreference() {
  return localStorage.getItem(TRAIL_BREAKDOWN_VIEW_KEY) ?? 'grid';
}

export function setVewByPreference(value?: string) {
  return localStorage.setItem(TRAIL_BREAKDOWN_VIEW_KEY, value ?? 'grid');
}

export function getSortByPreference(target: string): SortSeriesByOption | null {
  const sortBy = localStorage.getItem(`${TRAIL_BREAKDOWN_SORT_KEY}.${target}.by`);
  return (sortBy as SortSeriesByOption) || null;
}

export function setSortByPreference(target: string, sortBy: SortSeriesByOption) {
  // Prevent storing empty values
  if (sortBy) {
    localStorage.setItem(`${TRAIL_BREAKDOWN_SORT_KEY}.${target}.by`, `${sortBy}`);
  }
}
