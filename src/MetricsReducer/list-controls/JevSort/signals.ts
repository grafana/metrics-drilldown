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
