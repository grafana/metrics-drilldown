import { type DataTrail } from 'AppDataTrail/DataTrail';

import { getMetricLabelEnricher, MetricLabelEnricher } from './labelNames';

const signal = () => new AbortController().signal;

it('isolates successful evidence by trail and time/datasource context', async () => {
  const firstTrail = {} as DataTrail;
  const secondTrail = {} as DataTrail;
  const first = getMetricLabelEnricher(firstTrail);
  const second = getMetricLabelEnricher(secondTrail);
  expect(getMetricLabelEnricher(firstTrail)).toBe(first);
  const lookup = jest.fn().mockResolvedValueOnce(['old_label']).mockResolvedValue(['new_label']);
  expect((await first.enrich(['up'], 'prom:old-range', lookup, signal())).get('up')).toEqual(['old_label']);
  expect((await second.enrich(['up'], 'prom:old-range', lookup, signal())).get('up')).toEqual(['new_label']);
  expect((await first.enrich(['up'], 'prom:new-range', lookup, signal())).get('up')).toEqual(['new_label']);
  expect(lookup).toHaveBeenCalledTimes(3);
});

it('retries failed lookups and expires successful evidence after one minute', async () => {
  jest.useFakeTimers();
  try {
    const enricher = new MetricLabelEnricher();
    const lookup = jest.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValue(['job']);
    expect((await enricher.enrich(['up'], 'ctx', lookup, signal())).has('up')).toBe(false);
    expect((await enricher.enrich(['up'], 'ctx', lookup, signal())).get('up')).toEqual(['job']);
    await enricher.enrich(['up'], 'ctx', lookup, signal());
    expect(lookup).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(60_000);
    await enricher.enrich(['up'], 'ctx', lookup, signal());
    expect(lookup).toHaveBeenCalledTimes(3);
  } finally {
    jest.useRealTimers();
  }
});

it('returns available evidence at the deadline and never caches late results', async () => {
  jest.useFakeTimers();
  try {
    const enricher = new MetricLabelEnricher();
    let release!: (labels: string[]) => void;
    const lookup = jest.fn().mockImplementationOnce(
      () =>
        new Promise<string[]>((resolve) => {
          release = resolve;
        })
    );
    const pending = enricher.enrich(['up'], 'ctx', lookup, signal());
    await jest.advanceTimersByTimeAsync(1000);
    expect((await pending).size).toBe(0);
    release(['late_label']);
    await jest.advanceTimersByTimeAsync(0);
    lookup.mockResolvedValue(['current_label']);
    expect((await enricher.enrich(['up'], 'ctx', lookup, signal())).get('up')).toEqual(['current_label']);
    expect(lookup).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

it('does no lookup for an already-aborted generation', async () => {
  const controller = new AbortController();
  controller.abort();
  const lookup = jest.fn();
  expect((await new MetricLabelEnricher().enrich(['up'], 'ctx', lookup, controller.signal)).size).toBe(0);
  expect(lookup).not.toHaveBeenCalled();
});
