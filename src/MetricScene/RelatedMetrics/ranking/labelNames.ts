import { type DataTrail } from 'AppDataTrail/DataTrail';
import { type MetricDatasourceHelper } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';

const cache = new Map<string, Promise<string[]>>();
const MAX_CONCURRENT = 6;
let active = 0;
const queue: Array<() => void> = [];

function run<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = () => {
      active++;
      // Promise.resolve().then() turns a synchronous throw into a rejection so the slot is always released.
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          active--;
          queue.shift()?.();
        });
    };
    if (active < MAX_CONCURRENT) {
      start();
    } else {
      queue.push(start);
    }
  });
}

/** The helper owns the runtime datasource; this keeps label access on the active trail datasource. */
export function lookupMetricLabelNames(
  trail: DataTrail,
  datasourceUid: string | undefined,
  metric: string
): Promise<string[]> {
  const key = `${datasourceUid ?? ''}:${metric}`;
  const existing = cache.get(key);
  if (existing) {
    return existing;
  }

  const helper = (trail as unknown as { datasourceHelper: MetricDatasourceHelper }).datasourceHelper;
  const request = run(() => helper.getLabelNamesForMetric(metric)).catch(() => []);
  cache.set(key, request);
  return request;
}

export function clearMetricLabelNamesCache() {
  cache.clear();
}
