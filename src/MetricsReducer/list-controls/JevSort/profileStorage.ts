import { t } from '@grafana/i18n';

import { jevStorageScope } from './personalization';
import {
  isObject,
  MAX_PROFILE_BYTES,
  validateRankingProfile,
  type RankingProfile,
  type SavedRankingProfile,
} from './profile';

export const RANKING_PROFILE_CHANGED = 'gmd-jev-ranking-profile-changed';
export function rankingProfileStorageKey(datasourceUid: string): string | undefined {
  const scope = jevStorageScope(datasourceUid);
  return scope ? `grafana-metricsdrilldown-app.jev-profile-v1.${scope}` : undefined;
}
export function readRankingProfile(datasourceUid: string): SavedRankingProfile | undefined {
  const key = rankingProfileStorageKey(datasourceUid);
  if (!key) {
    return;
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length > MAX_PROFILE_BYTES + 1024) {
      return;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || Object.keys(parsed).length !== 2 || typeof parsed.shareWithJev !== 'boolean') {
      return;
    }
    return { profile: validateRankingProfile(parsed.profile), shareWithJev: parsed.shareWithJev };
  } catch {
    // Corrupt or inaccessible settings cannot imply consent or break catalog navigation.
    return;
  }
}

/** The editor binds its opening scope. A late completion cannot write into another identity/datasource. */
export function saveRankingProfile(
  datasourceUid: string,
  openingKey: string,
  profile: RankingProfile | undefined,
  shareWithJev = false,
  expectedRevision?: string
): void {
  const key = rankingProfileStorageKey(datasourceUid);
  if (!key || key !== openingKey) {
    throw new Error(
      t('jev-profile.storage-scope', 'Ranking profile scope changed. Reopen settings for the current datasource.')
    );
  }
  if (
    expectedRevision !== undefined &&
    expectedRevision !== JSON.stringify(readRankingProfile(datasourceUid) ?? null)
  ) {
    throw new Error(
      t('jev-profile.storage-conflict', 'Ranking profile changed in another view. Reopen settings before saving.')
    );
  }
  const saved: SavedRankingProfile | undefined = profile
    ? { profile: validateRankingProfile(profile), shareWithJev: shareWithJev === true }
    : undefined;
  // Propagate storage errors to the editor: never claim that an unsaved draft is active.
  if (saved) {
    localStorage.setItem(key, JSON.stringify(saved));
  } else {
    localStorage.removeItem(key);
  }
  window.dispatchEvent(new CustomEvent(RANKING_PROFILE_CHANGED, { detail: key }));
}
