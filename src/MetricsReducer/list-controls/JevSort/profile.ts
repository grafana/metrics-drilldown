import { t } from '@grafana/i18n';

import { isValidMetricName } from 'MetricScene/RelatedMetrics/ranking/buildRankingRequest';

export const MAX_PROFILE_BYTES = 8192;
export const MAX_PROFILE_RULES = 20;
export const PROFILE_PRIORITY_BOOST = 0.1;
export const PROFILE_URL_TEXT = /\b(?:[a-z][a-z\d+.-]*:\/\/|www\.)[^\s]+/gi;

export interface RankingProfileRule {
  match: { exact: string } | { prefix: string };
  purpose: string;
  priority: 'high' | 'normal' | 'low';
}
export interface RankingProfile {
  schemaVersion: 1;
  name: string;
  intent: string;
  rules: RankingProfileRule[];
}
export interface SavedRankingProfile {
  profile: RankingProfile;
  /** Separate from model-authored/imported JSON; changing a draft requires fresh UI consent. */
  shareWithJev: boolean;
}

export const PROFILE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'name', 'intent', 'rules'],
  properties: {
    schemaVersion: { const: 1 },
    name: { type: 'string', minLength: 1, maxLength: 80 },
    intent: { type: 'string', maxLength: 600 },
    rules: {
      type: 'array',
      maxItems: MAX_PROFILE_RULES,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['match', 'purpose', 'priority'],
        properties: {
          match: {
            oneOf: ['exact', 'prefix'].map((key) => ({
              type: 'object',
              additionalProperties: false,
              required: [key],
              properties: {
                [key]: { type: 'string', minLength: 1, maxLength: 256, pattern: '^[a-zA-Z_:][a-zA-Z0-9_:]*$' },
              },
            })),
          },
          purpose: { type: 'string', minLength: 1, maxLength: 300 },
          priority: { enum: ['high', 'normal', 'low'] },
        },
      },
    },
  },
};

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
function text(value: unknown, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new Error(t('jev-profile.invalid-text', 'Invalid or oversized profile text.'));
  }
  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) {
    throw new Error(t('jev-profile.blank-field', 'Profile fields must not be blank.'));
  }
  return trimmed;
}

/** Same validator for manual JSON, Assistant drafts, and scoped storage. Never coerce unknown fields. */
export function validateRankingProfile(value: unknown): RankingProfile {
  if (
    !isObject(value) ||
    !exactKeys(value, ['schemaVersion', 'name', 'intent', 'rules']) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.rules) ||
    value.rules.length > MAX_PROFILE_RULES
  ) {
    throw new Error(
      t('jev-profile.invalid-shape', 'Expected a version 1 ranking profile with name, intent, and at most 20 rules.')
    );
  }
  const rules = value.rules.map((raw: unknown): RankingProfileRule => {
    if (!isObject(raw) || !exactKeys(raw, ['match', 'purpose', 'priority']) || !isObject(raw.match)) {
      throw new Error(t('jev-profile.invalid-rule', 'Each rule needs match, purpose, and priority.'));
    }
    const key = Object.hasOwn(raw.match, 'exact') ? 'exact' : 'prefix';
    if (!exactKeys(raw.match, [key])) {
      throw new Error(
        t('jev-profile.invalid-matcher', 'Use one exact or prefix matcher, not regex or multiple matchers.')
      );
    }
    const name = text(raw.match[key], 256);
    if (!isValidMetricName(name) || !['high', 'normal', 'low'].includes(String(raw.priority))) {
      throw new Error(t('jev-profile.invalid-priority', 'Invalid metric matcher or priority.'));
    }
    return {
      match: key === 'exact' ? { exact: name } : { prefix: name },
      purpose: text(raw.purpose, 300),
      priority: raw.priority as RankingProfileRule['priority'],
    };
  });
  const matchers = rules.map((rule) => JSON.stringify(rule.match));
  if (new Set(matchers).size !== matchers.length) {
    throw new Error(t('jev-profile.duplicate-matcher', 'Duplicate profile matchers are not allowed.'));
  }
  const profile: RankingProfile = {
    schemaVersion: 1,
    name: text(value.name, 80),
    intent: text(value.intent, 600, true),
    rules,
  };
  if (new TextEncoder().encode(JSON.stringify(profile)).length > MAX_PROFILE_BYTES) {
    throw new Error(t('jev-profile.size', 'Ranking profiles must fit within 8 KiB.'));
  }
  return profile;
}
export function formatRankingProfile(profile: RankingProfile): string {
  const pretty = JSON.stringify(profile, null, 2);
  // A valid canonical profile must remain editable even when indentation exceeds the editor's byte budget.
  return new TextEncoder().encode(pretty).length > MAX_PROFILE_BYTES ? JSON.stringify(profile) : pretty;
}

export function parseRankingProfile(json: string): RankingProfile {
  if (new TextEncoder().encode(json).length > MAX_PROFILE_BYTES) {
    throw new Error(t('jev-profile.size', 'Ranking profiles must fit within 8 KiB.'));
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error(t('jev-profile.json-only', 'Enter valid JSON; no markdown or surrounding text.'));
  }
  return validateRankingProfile(value);
}

/** Exact wins, then longest prefix. Rules never stack; JSON order is not ranking authority. */
export function matchProfileRule(profile: RankingProfile | undefined, name: string): RankingProfileRule | undefined {
  const exact = profile?.rules.find((rule) => 'exact' in rule.match && rule.match.exact === name);
  if (exact) {
    return exact;
  }
  return profile?.rules
    .filter((rule) => 'prefix' in rule.match && name.startsWith(rule.match.prefix))
    .sort(
      (a, b) => ('prefix' in b.match ? b.match.prefix.length : 0) - ('prefix' in a.match ? a.match.prefix.length : 0)
    )[0];
}
export function profileBoost(rule: RankingProfileRule | undefined): number {
  if (!rule || rule.priority === 'normal') {
    return 0;
  }
  return rule.priority === 'high' ? PROFILE_PRIORITY_BOOST : -PROFILE_PRIORITY_BOOST;
}
export function semanticProfileText(value: string, max: number): string {
  return value.replace(PROFILE_URL_TEXT, '[link omitted]').slice(0, max);
}

export const EMPTY_PROFILE: RankingProfile = { schemaVersion: 1, name: 'My ranking profile', intent: '', rules: [] };
