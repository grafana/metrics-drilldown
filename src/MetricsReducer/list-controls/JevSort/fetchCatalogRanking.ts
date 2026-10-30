import { getBackendSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';

import { validateCatalogScore, type CatalogRequest, type CatalogResponse } from './ranking';

export const CATALOG_PROFILE_PROMPT_VERSION = 'catalog-rubric-profile-v2';
export const CATALOG_RANK_URL = '/api/plugins/grafana-asserts-app/resources/jev/v1/catalog-metrics/rank';
const STATUSES = new Set(['ok', 'partial', 'low_confidence', 'upstream_error', 'timeout', 'disabled', 'invalid']);

export function parseCatalogResponse(value: unknown, request: CatalogRequest): CatalogResponse | undefined {
  if (!value || typeof value !== 'object') {
    return;
  }
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.status !== 'string' ||
    !STATUSES.has(raw.status) ||
    !raw.scores ||
    typeof raw.scores !== 'object' ||
    Array.isArray(raw.scores)
  ) {
    return;
  }
  if (!compatibleProfilePrompt(raw, request)) {
    return;
  }
  const entries = raw.scores as Record<string, unknown>;
  const scores = Object.fromEntries(
    request.candidates.flatMap(({ id }) => {
      const score = validateCatalogScore(entries[id]);
      return score ? [[id, score]] : [];
    })
  );
  return {
    status: raw.status as CatalogResponse['status'],
    scores,
    ...(typeof raw.model === 'string' ? { model: raw.model } : {}),
    ...(typeof raw.promptVersion === 'string' ? { promptVersion: raw.promptVersion } : {}),
    ...(typeof raw.cached === 'boolean' ? { cached: raw.cached } : {}),
    ...(typeof raw.latencyMs === 'number' && Number.isFinite(raw.latencyMs) ? { latencyMs: raw.latencyMs } : {}),
    ...(typeof raw.fallbackReason === 'string' ? { fallbackReason: raw.fallbackReason } : {}),
    ...(raw.usage && typeof raw.usage === 'object' ? { usage: parseUsage(raw.usage) } : {}),
  };
}
function compatibleProfilePrompt(raw: Record<string, unknown>, request: CatalogRequest): boolean {
  return (
    request.schemaVersion !== 2 ||
    !['ok', 'partial'].includes(String(raw.status)) ||
    raw.promptVersion === CATALOG_PROFILE_PROMPT_VERSION
  );
}
function parseUsage(value: object) {
  const usage = value as Record<string, unknown>;
  const inputTokens = usage.input_tokens ?? usage.inputTokens;
  return {
    ...(typeof inputTokens === 'number' && Number.isFinite(inputTokens) && inputTokens >= 0 ? { inputTokens } : {}),
    ...(typeof usage.cost === 'number' && Number.isFinite(usage.cost) && usage.cost >= 0 ? { cost: usage.cost } : {}),
  };
}

export async function fetchCatalogRanking(request: CatalogRequest, signal: AbortSignal): Promise<CatalogResponse> {
  if (signal.aborted) {
    throw new Error('aborted');
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectAbort: (() => void) | undefined;
  try {
    const cancelled = new Promise<never>((_, reject) => {
      rejectAbort = () => reject(new Error('catalog ranking cancelled or timed out'));
      controller.signal.addEventListener('abort', rejectAbort, { once: true });
      timer = setTimeout(abort, 5000);
    });
    const response = await Promise.race([
      lastValueFrom(
        getBackendSrv().fetch<unknown>({
          url: CATALOG_RANK_URL,
          method: 'POST',
          data: request,
          headers: { 'Content-Type': 'application/json' },
          abortSignal: controller.signal,
          showErrorAlert: false,
          showSuccessAlert: false,
        })
      ),
      cancelled,
    ]);
    const parsed = parseCatalogResponse(response.data, request);
    if (!response.ok || response.status < 200 || response.status >= 300 || !parsed) {
      throw new Error('invalid catalog response');
    }
    return parsed;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    if (rejectAbort) {
      controller.signal.removeEventListener('abort', rejectAbort);
    }
  }
}
