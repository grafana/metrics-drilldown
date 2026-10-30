import { MetricLabelEnricher } from 'MetricScene/RelatedMetrics/ranking/labelNames';

it('bounds enrichment, retries failures and strips invalid/identity labels', async () => {
  const enricher = new MetricLabelEnricher();
  const signal = new AbortController().signal;
  let active = 0;
  let maximum = 0;
  const lookup = jest.fn(async () => {
    active++;
    maximum = Math.max(maximum, active);
    await Promise.resolve();
    active--;
    return ['__name__', 'otel_scope_name', 'bad-label'];
  });
  const result = await enricher.enrich(
    Array.from({ length: 40 }, (_, i) => `m${i}`),
    'ctx',
    lookup,
    signal
  );
  expect(maximum).toBeLessThanOrEqual(6);
  expect(result.get('m0')).toEqual(['otel_scope_name']);
  await enricher.enrich(['m0'], 'ctx', lookup, signal);
  expect(lookup).toHaveBeenCalledTimes(40);
  const failing = jest.fn().mockRejectedValue(new Error('no labels'));
  await enricher.enrich(['new'], 'ctx', failing, signal);
  await enricher.enrich(['new'], 'ctx', failing, signal);
  expect(failing).toHaveBeenCalledTimes(2);
});

it('stops queued lookups on abort and does not cache late results across contexts', async () => {
  const enricher = new MetricLabelEnricher();
  const controller = new AbortController();
  let release!: (labels: string[]) => void;
  const pending = new Promise<string[]>((resolve) => {
    release = resolve;
  });
  const lookup = jest.fn(() => pending);
  const result = enricher.enrich(
    Array.from({ length: 40 }, (_, i) => `m${i}`),
    'ctx',
    lookup,
    controller.signal
  );
  controller.abort();
  expect((await result).size).toBe(0);
  expect(lookup).toHaveBeenCalledTimes(6);
  await enricher.enrich(['other'], 'different', lookup, new AbortController().signal);
  expect(lookup).toHaveBeenCalledTimes(6); // six old calls still in flight, no new burst
  release(['otel_scope_name']);
  await Promise.resolve();
  await Promise.resolve();
  await enricher.enrich(['m0'], 'ctx', lookup, new AbortController().signal);
  expect(lookup).toHaveBeenCalledTimes(7);
});
