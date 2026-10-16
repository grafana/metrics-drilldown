import { config } from '@grafana/runtime';

import { isValidMetricName } from 'MetricScene/RelatedMetrics/ranking/buildRankingRequest';
import { isJevEnabled } from 'MetricScene/RelatedMetrics/ranking/toggles';
import { VAR_DATASOURCE } from 'shared/shared';
import { PREF_KEYS } from 'shared/user-preferences/pref-keys';
import { userStorage } from 'shared/user-preferences/userStorage';

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_TTL_MS = 30 * DAY_MS;
const HALF_LIFE_MS = 7 * DAY_MS;
const MAX_ENTRIES = 50;
const MAX_VISITS = 5;
export const PERSONAL_SIGNALS_CHANGED = 'gmd-jev-personal-signals-changed';
export const MAX_HISTORY_BOOST = 0.1;
export const BOOKMARK_BOOST = 0.1;
export const MAX_PERSONAL_BOOST = MAX_HISTORY_BOOST + BOOKMARK_BOOST;

interface Visit {
  name: string;
  viewedAt: number;
  /** Recency-decayed visit mass, not a lifetime visit count. */
  weight: number;
}
interface SavedBookmark {
  name: string;
  createdAt: number;
}
interface StoredSignals {
  visits: Visit[];
  bookmarks: SavedBookmark[];
}
export interface PersonalSignals {
  historyBoosts: Record<string, number>;
  bookmarks: string[];
}

/** No anonymous identity, guessed datasource, or automatic import of legacy browser records. */
export function personalStorageKey(datasourceUid: string): string | undefined {
  const user = config.bootData?.user;
  if (
    !isJevEnabled() ||
    !user?.isSignedIn ||
    !Number.isSafeInteger(user.id) ||
    user.id <= 0 ||
    !Number.isSafeInteger(user.orgId) ||
    user.orgId <= 0 ||
    !datasourceUid ||
    datasourceUid.length > 256 ||
    datasourceUid.startsWith('$')
  ) {
    return;
  }
  return `grafana-metricsdrilldown-app.jev-personal-v1.${JSON.stringify([user.orgId, user.id, datasourceUid])}`;
}

function isMetricName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 256 && isValidMetricName(value);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isTimestamp(value: unknown, now: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= now;
}
function decay(elapsed: number): number {
  return 2 ** (-elapsed / HALF_LIFE_MS);
}
function read(key: string, now: number): StoredSignals {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length > 64 * 1024) {
      return { visits: [], bookmarks: [] };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return { visits: [], bookmarks: [] };
    }
    const visits = (Array.isArray(parsed.visits) ? parsed.visits : [])
      .filter(
        (v: unknown): v is Visit =>
          isRecord(v) &&
          isMetricName(v.name) &&
          isTimestamp(v.viewedAt, now) &&
          now - v.viewedAt < HISTORY_TTL_MS &&
          typeof v.weight === 'number' &&
          Number.isFinite(v.weight) &&
          v.weight > 0 &&
          v.weight <= MAX_VISITS
      )
      .sort((a: Visit, b: Visit) => b.viewedAt - a.viewedAt)
      .slice(0, MAX_ENTRIES);
    const bookmarks = (Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [])
      .filter((b: unknown): b is SavedBookmark => isRecord(b) && isMetricName(b.name) && isTimestamp(b.createdAt, now))
      .sort((a: SavedBookmark, b: SavedBookmark) => b.createdAt - a.createdAt)
      .slice(0, MAX_ENTRIES);
    return { visits, bookmarks };
  } catch {
    return { visits: [], bookmarks: [] };
  }
}
function write(key: string, data: StoredSignals): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(PERSONAL_SIGNALS_CHANGED, { detail: key }));
  } catch {
    // Personalization is optional; blocked/full storage must not interrupt navigation or bookmarking.
  }
}

/** Called only for metric-selection events, never panel renders or query refreshes. */
export function recordMetricVisit(datasourceUid: string, name: string): void {
  const key = personalStorageKey(datasourceUid);
  if (!key || !isMetricName(name)) {
    return;
  }
  const now = Date.now();
  const data = read(key, now);
  const previous = data.visits.find((v) => v.name === name);
  // Do not turn repeated selection events/rapid navigation into an unbounded popularity signal.
  if (previous && now - previous.viewedAt < 60_000) {
    return;
  }
  const weight = Math.min(MAX_VISITS, 1 + (previous ? previous.weight * decay(now - previous.viewedAt) : 0));
  data.visits = [{ name, viewedAt: now, weight }, ...data.visits.filter((v) => v.name !== name)].slice(0, MAX_ENTRIES);
  write(key, data);
}

/** Keep only metric identity + creation time, not the bookmark's URL, queries, or label values. */
export function recordMetricBookmark(datasourceUid: string, name: string, createdAt: number, saved: boolean): void {
  const key = personalStorageKey(datasourceUid);
  if (!key || !isMetricName(name) || !isTimestamp(createdAt, Date.now())) {
    return;
  }
  const data = read(key, Date.now());
  data.bookmarks = data.bookmarks.filter((b) => b.name !== name || b.createdAt !== createdAt);
  if (saved) {
    data.bookmarks.unshift({ name, createdAt });
  }
  data.bookmarks = data.bookmarks.slice(0, MAX_ENTRIES);
  write(key, data);
}

/** Validate only previously attributed bookmarks; never import legacy entries as personal evidence. */
function currentBookmarkIds(datasourceUid: string): Set<string> {
  try {
    const bookmarks: unknown = userStorage.getItem(PREF_KEYS.BOOKMARKS);
    if (Array.isArray(bookmarks)) {
      return new Set(
        bookmarks.flatMap((b: unknown) =>
          isRecord(b) &&
          isRecord(b.urlValues) &&
          b.urlValues[`var-${VAR_DATASOURCE}`] === datasourceUid &&
          isMetricName(b.urlValues.metric) &&
          typeof b.createdAt === 'number'
            ? [JSON.stringify([b.urlValues.metric, b.createdAt])]
            : []
        )
      );
    }
  } catch {
    // Missing/corrupt legacy storage cannot establish that an attributed bookmark still exists.
  }
  return new Set();
}

export function getPersonalSignals(datasourceUid: string): PersonalSignals {
  const key = personalStorageKey(datasourceUid);
  const now = Date.now();
  const data = key ? read(key, now) : { visits: [], bookmarks: [] };
  const existing = key ? currentBookmarkIds(datasourceUid) : new Set<string>();
  // Stable within the same freshness minute so rapid identical rank calls still coalesce.
  const decayTime = Math.floor(now / 60_000) * 60_000;
  return {
    historyBoosts: Object.fromEntries(
      data.visits.map((v) => [
        v.name,
        MAX_HISTORY_BOOST * (v.weight / MAX_VISITS) * decay(Math.max(0, decayTime - v.viewedAt)),
      ])
    ),
    bookmarks: [
      ...new Set(data.bookmarks.filter((b) => existing.has(JSON.stringify([b.name, b.createdAt]))).map((b) => b.name)),
    ],
  };
}
