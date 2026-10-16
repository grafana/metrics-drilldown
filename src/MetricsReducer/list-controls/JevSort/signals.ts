import { getPersonalSignals, type PersonalSignals } from './personalization';
import { type LocalSignals } from './ranking';
import { type MetricsSorter } from '../MetricsSorter/MetricsSorter';

export interface SignalSnapshot {
  signals: LocalSignals;
  status: string;
  burnStatus: string;
  fetchedAt: number;
  directAlerts: 'unattributed';
}

export async function boundedWait<T>(task: Promise<T>, signal: AbortSignal, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    const stopped = new Promise<never>((_, reject) => {
      abort = () => reject(new Error('signal acquisition interrupted'));
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(abort, timeoutMs);
      if (signal.aborted) {
        abort();
      }
    });
    return await Promise.race([task, stopped]);
  } finally {
    clearTimeout(timer);
    if (abort) {
      signal.removeEventListener('abort', abort);
    }
  }
}

export async function acquireCatalogSignals(
  sorter: MetricsSorter,
  datasourceUid: string,
  personal: PersonalSignals = getPersonalSignals(datasourceUid)
): Promise<SignalSnapshot> {
  const slo = await sorter.getSloMetricSignals(datasourceUid);
  return {
    signals: {
      trackedMetrics: slo.trackedMetrics,
      activeBurnMetrics: slo.burnStatus === 'error' ? new Set() : slo.activeBurnMetrics,
      // The org-wide ruler response cannot prove source datasource attribution. Never guess.
      attributedFiringCounts: new Map(),
      dashboardCounts: sorter.peekUsageCounts('dashboard-usage'),
      alertCounts: sorter.peekUsageCounts('alerting-usage'),
      personal,
    },
    status: slo.status,
    burnStatus: slo.burnStatus ?? 'unknown',
    fetchedAt: sorter.getSignalFetchedAt(datasourceUid),
    directAlerts: 'unattributed',
  };
}

/** Trail-scoped bounded cache. No module-wide cache can leak evidence between embedded trails. */
export class CatalogLabelEnricher {
  private cache = new Map<string, { labels: string[]; expires: number }>();
  private active = 0;

  public async enrich(
    names: string[],
    context: string,
    lookup: (name: string) => Promise<string[]>,
    signal: AbortSignal,
    budgetMs = 1000
  ): Promise<Map<string, string[]>> {
    const labels = new Map<string, string[]>();
    const deadline = Date.now() + budgetMs;
    let cursor = 0;
    const workers = Array.from({ length: Math.min(6 - this.active, names.length) }, async () => {
      while (!signal.aborted && Date.now() < deadline && cursor < names.length) {
        const name = names[cursor++];
        const key = JSON.stringify([context, name]);
        const cached = this.cache.get(key);
        if (cached && cached.expires > Date.now()) {
          labels.set(name, cached.labels);
          continue;
        }
        this.active++;
        try {
          const result = await lookup(name);
          if (signal.aborted || Date.now() >= deadline) {
            return;
          }
          const safe = result.filter((label) => label !== '__name__' && /^[a-zA-Z_]\w*$/.test(label)).slice(0, 30);
          labels.set(name, safe);
          this.cache.set(key, { labels: safe, expires: Date.now() + 60_000 });
          if (this.cache.size > 200) {
            this.cache.delete(this.cache.keys().next().value!);
          }
        } catch {
          // Do not cache a failure as negative evidence.
        } finally {
          this.active--;
        }
      }
    });
    // Grafana's version-aware language provider has no portable request-abort argument. We stop
    // queued work and ignore late results; at most six already-started datasource calls may finish.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    const stop = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, budgetMs);
      abort = () => resolve();
      signal.addEventListener('abort', abort, { once: true });
    });
    await Promise.race([Promise.all(workers), stop]);
    clearTimeout(timer);
    if (abort) {
      signal.removeEventListener('abort', abort);
    }
    return labels;
  }
}
