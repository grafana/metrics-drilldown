import { getLoadedSemconvIndex, loadSemconvIndex } from './loadSemconv';

describe('loadSemconvIndex', () => {
  it('loads the index lazily and memoizes it', async () => {
    expect(getLoadedSemconvIndex()).toBeUndefined();

    const first = loadSemconvIndex();
    expect(loadSemconvIndex()).toBe(first);

    const index = await first;
    expect(getLoadedSemconvIndex()).toBe(index);
    expect(index.lookupMetric('process_cpu_time_seconds_total')?.primary.otelName).toBe('process.cpu.time');
  });
});
