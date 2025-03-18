// run in terminal with `npx ts-node src/groupBy/groupBy.benchmark.ts`

import { groupByStrategies } from './groupBy';
import { MetricsList } from './MetricsList';

/**
 * Simple benchmark function to measure execution time
 * @param fn Function to benchmark
 * @param iterations Number of iterations to run
 * @returns Average execution time in ms
 */
function benchmark(fn: () => void, iterations = 5): number {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  // Return average time
  return times.reduce((sum, time) => sum + time, 0) / times.length;
}

// Create metric lists of various sizes
const metrics1000 = MetricsList.slice(0, 1000);
const metrics5000 = MetricsList.slice(0, 5000);
const metrics10000 = MetricsList.slice(0, 10000);
const metrics20000 = MetricsList.slice(0, Math.min(20000, MetricsList.length));

// Run benchmarks
console.log('===== groupByStrategies Benchmarks =====');
console.log('Each benchmark runs 5 times with the average time reported\n');

const time1000 = benchmark(() => groupByStrategies(metrics1000));
console.log(`1,000 metrics: ${time1000.toFixed(2)} ms`);

const time5000 = benchmark(() => groupByStrategies(metrics5000));
console.log(`5,000 metrics: ${time5000.toFixed(2)} ms`);

const time10000 = benchmark(() => groupByStrategies(metrics10000));
console.log(`10,000 metrics: ${time10000.toFixed(2)} ms`);

const time20000 = benchmark(() => groupByStrategies(metrics20000));
console.log(`${metrics20000.length} metrics: ${time20000.toFixed(2)} ms`);

// Show relative performance
console.log('\n===== Relative Performance =====');
console.log(`5,000 metrics is ${(time5000 / time1000).toFixed(2)}x slower than 1,000 metrics`);
console.log(`10,000 metrics is ${(time10000 / time1000).toFixed(2)}x slower than 1,000 metrics`);
console.log(`${metrics20000.length} metrics is ${(time20000 / time1000).toFixed(2)}x slower than 1,000 metrics`);

// Calculate metrics processed per millisecond
console.log('\n===== Processing Rate =====');
console.log(`1,000 metrics: ${(1000 / time1000).toFixed(2)} metrics/ms`);
console.log(`5,000 metrics: ${(5000 / time5000).toFixed(2)} metrics/ms`);
console.log(`10,000 metrics: ${(10000 / time10000).toFixed(2)} metrics/ms`);
console.log(`${metrics20000.length} metrics: ${(metrics20000.length / time20000).toFixed(2)} metrics/ms`);
