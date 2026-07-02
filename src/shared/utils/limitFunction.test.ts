import { limitFunction } from './limitFunction';

describe('limitFunction', () => {
  test('limits concurrent execution to the specified concurrency', async () => {
    let activeCount = 0;
    let maxActive = 0;

    const fn = jest.fn(async () => {
      activeCount++;
      maxActive = Math.max(maxActive, activeCount);
      await new Promise((r) => setTimeout(r, 10));
      activeCount--;
    });

    const limited = limitFunction(fn, { concurrency: 3 });

    await Promise.all(Array.from({ length: 10 }, () => limited()));

    expect(maxActive).toBe(3);
    expect(fn).toHaveBeenCalledTimes(10);
  });

  test('all queued calls eventually complete', async () => {
    let completedCount = 0;

    const fn = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 1));
      completedCount++;
    });

    const limited = limitFunction(fn, { concurrency: 2 });

    await Promise.all(Array.from({ length: 5 }, () => limited()));

    expect(completedCount).toBe(5);
  });

  test('propagates resolved values', async () => {
    const fn = jest.fn(async (x: number) => x * 2);
    const limited = limitFunction(fn, { concurrency: 2 });

    const results = await Promise.all([limited(1), limited(2), limited(3)]);

    expect(results).toEqual([2, 4, 6]);
  });

  test('propagates rejections', async () => {
    const fn = jest.fn(async () => {
      throw new Error('fail');
    });

    const limited = limitFunction(fn, { concurrency: 2 });

    await expect(limited()).rejects.toThrow('fail');
  });

  test('works with concurrency of 1 (serial execution)', async () => {
    const order: number[] = [];

    const fn = jest.fn(async (id: number) => {
      order.push(id);
      await new Promise((r) => setTimeout(r, 1));
    });

    const limited = limitFunction(fn, { concurrency: 1 });

    await Promise.all([limited(1), limited(2), limited(3)]);

    expect(order).toEqual([1, 2, 3]);
  });
});
