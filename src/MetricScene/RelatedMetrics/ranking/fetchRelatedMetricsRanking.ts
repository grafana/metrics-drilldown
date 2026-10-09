import { getBackendSrv, type BackendSrvRequest } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';

import { type RankingResult, type RelatedMetricsRankingRequest, type RelatedMetricsRankingResponse } from './types';

const URL = '/api/plugins/grafana-asserts-app/resources/jev/v1/related-metrics/rank';
const TIMEOUT_MS = 5000;
const STATUSES = new Set(['ok', 'low_confidence', 'invalid', 'upstream_error', 'timeout', 'disabled']);

function parseResponse(value: unknown, candidateIds: Set<string>): RelatedMetricsRankingResponse | undefined {
  if (!value || typeof value !== 'object') {
    return;
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.status !== 'string' || !STATUSES.has(raw.status)) {
    return;
  }
  const scores = objectField(raw.scores) ? filterNumericMap(raw.scores as object, candidateIds) : undefined;
  const relationships = objectField(raw.relationships)
    ? filterRelationships(raw.relationships as object, candidateIds)
    : {};
  const usage = objectField(raw.usage) ? parseUsage(raw.usage as object) : undefined;
  return {
    status: raw.status as RelatedMetricsRankingResponse['status'],
    ...optionalString(raw, 'model'),
    ...optionalString(raw, 'promptVersion'),
    ...(typeof raw.cached === 'boolean' ? { cached: raw.cached } : {}),
    ...(typeof raw.latencyMs === 'number' ? { latencyMs: raw.latencyMs } : {}),
    recommended: parseRecommended(raw.recommended, candidateIds),
    ...(scores && Object.keys(scores).length ? { scores } : {}),
    relationships,
    ...(usage ? { usage } : {}),
    ...optionalString(raw, 'fallbackReason'),
  };
}

function objectField(value: unknown): value is object {
  return !!value && typeof value === 'object';
}

function optionalString(raw: Record<string, unknown>, key: string) {
  return typeof raw[key] === 'string' ? { [key]: raw[key] } : {};
}

function parseRecommended(value: unknown, candidateIds: Set<string>) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const entry = item as Record<string, unknown>;
    return typeof entry.id === 'string' && candidateIds.has(entry.id)
      ? [{ id: entry.id, ...(typeof entry.p === 'number' ? { p: entry.p } : {}) }]
      : [];
  });
}

function filterNumericMap(value: object, ids: Set<string>): Record<string, number> {
  return Object.fromEntries(Object.entries(value).filter(([id, score]) => ids.has(id) && typeof score === 'number'));
}

function filterRelationships(value: object, ids: Set<string>) {
  const result: RelatedMetricsRankingResponse['relationships'] = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!ids.has(id) || !raw || typeof raw !== 'object') {
      continue;
    }
    const relationship = raw as Record<string, unknown>;
    const classes = new Set(['same_signal_family', 'investigative_companion', 'weakly_related', 'unrelated']);
    result[id] = {
      ...(typeof relationship.class === 'string' && classes.has(relationship.class)
        ? { class: relationship.class as NonNullable<(typeof result)[string]>['class'] }
        : {}),
      ...(typeof relationship.confidence === 'number' ? { confidence: relationship.confidence } : {}),
      ...(relationship.probabilities && typeof relationship.probabilities === 'object'
        ? {
            probabilities: filterNumericMap(
              relationship.probabilities,
              new Set(Object.keys(relationship.probabilities))
            ),
          }
        : {}),
    };
  }
  return result;
}

function parseUsage(value: object) {
  const usage = value as Record<string, unknown>;
  const parsed = {
    ...(typeof usage.inputTokens === 'number' ? { inputTokens: usage.inputTokens } : {}),
    ...(typeof usage.cost === 'number' ? { cost: usage.cost } : {}),
  };
  return Object.keys(parsed).length ? parsed : undefined;
}

export function parseRankingResponse(value: unknown, candidateIds: Iterable<string>) {
  return parseResponse(value, new Set(candidateIds));
}

function resultFromResponse(
  response: { ok: boolean; status: number; data: unknown },
  candidateIds: Set<string>,
  started: number
): RankingResult {
  if (!response.ok || response.status < 200 || response.status >= 300) {
    return { ok: false, reason: 'http' };
  }
  const parsed = parseResponse(response.data, candidateIds);
  if (!parsed) {
    return { ok: false, reason: 'invalid-response' };
  }
  if (parsed.status !== 'ok') {
    return { ok: false, reason: 'not-ok', response: parsed };
  }
  return { ok: true, response: parsed, latencyMs: performance.now() - started };
}

function resultFromError(error: unknown, candidateIds: Set<string>): RankingResult {
  // A non-2xx response surfaces as a rejected fetch; keep the server payload for the debug overlay.
  const data = (error as { data?: unknown } | undefined)?.data;
  const parsed = data === undefined ? undefined : parseResponse(data, candidateIds);
  return parsed ? { ok: false, reason: 'http', response: parsed } : { ok: false, reason: 'network' };
}

export async function fetchRelatedMetricsRanking(
  request: RelatedMetricsRankingRequest,
  candidateIds: Iterable<string>,
  signal?: AbortSignal
): Promise<RankingResult> {
  const started = performance.now();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  // Settles the race as soon as the caller aborts or the timeout fires, even if the transport does not.
  let rejectOnAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(new Error('ranking request aborted'));
    controller.signal.addEventListener('abort', rejectOnAbort, { once: true });
  });
  aborted.catch(() => undefined);
  const backendRequest: BackendSrvRequest = {
    url: URL,
    method: 'POST',
    data: request,
    headers: { 'Content-Type': 'application/json' },
    showErrorAlert: false,
    showSuccessAlert: false,
    abortSignal: controller.signal,
  };
  const ids = new Set(candidateIds);
  try {
    const response = await Promise.race([lastValueFrom(getBackendSrv().fetch(backendRequest)), aborted]);
    return resultFromResponse(response, ids, started);
  } catch (error) {
    if (timedOut) {
      return { ok: false, reason: 'timeout' };
    }
    if (controller.signal.aborted) {
      return { ok: false, reason: 'aborted' };
    }
    return resultFromError(error, ids);
  } finally {
    window.clearTimeout(timeout);
    if (rejectOnAbort) {
      controller.signal.removeEventListener('abort', rejectOnAbort);
    }
    signal?.removeEventListener('abort', abort);
  }
}
