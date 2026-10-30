import { type DataTrail } from 'AppDataTrail/DataTrail';

/** Bounded successful-result cache, shared only within one trail. */
export class MetricLabelEnricher {
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
    if (signal.aborted) {
      return labels;
    }
    const deadline = Date.now() + budgetMs;
    const missing = names.filter((name) => {
      const cached = this.cache.get(JSON.stringify([context, name]));
      if (cached && cached.expires > Date.now()) {
        labels.set(name, cached.labels);
        return false;
      }
      return true;
    });
    let cursor = 0;
    const workers = Array.from({ length: Math.min(6 - this.active, missing.length) }, async () => {
      while (!signal.aborted && Date.now() < deadline && cursor < missing.length) {
        const name = missing[cursor++];
        this.active++;
        try {
          const result = await lookup(name);
          if (signal.aborted || Date.now() >= deadline) {
            return;
          }
          const safe = result.filter((label) => label !== '__name__' && /^[a-zA-Z_]\w*$/.test(label)).slice(0, 30);
          labels.set(name, safe);
          this.cache.set(JSON.stringify([context, name]), { labels: safe, expires: Date.now() + 60_000 });
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
    // The language provider has no portable abort argument. Stop queued work and ignore late
    // results; at most six already-started datasource calls per trail may finish.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    const stop = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, budgetMs);
      abort = () => resolve();
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) {
        resolve();
      }
    });
    await Promise.race([Promise.all(workers), stop]);
    clearTimeout(timer);
    if (abort) {
      signal.removeEventListener('abort', abort);
    }
    return labels;
  }
}

const trailEnrichers = new WeakMap<DataTrail, MetricLabelEnricher>();

export function getMetricLabelEnricher(trail: DataTrail): MetricLabelEnricher {
  let enricher = trailEnrichers.get(trail);
  if (!enricher) {
    enricher = new MetricLabelEnricher();
    trailEnrichers.set(trail, enricher);
  }
  return enricher;
}
