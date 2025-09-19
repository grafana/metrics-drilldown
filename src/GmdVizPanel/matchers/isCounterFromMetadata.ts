import { type PromMetricsMetadataItem } from '@grafana/prometheus';

import { type DataTrail } from 'DataTrail';

/**
 * Maps Prometheus `metadata.type` to a binary "should use rate()" decision for timeseries queries.
 *
 * Mapping:
 * - 'counter' -> true (use rate)
 * - 'gauge' -> false (do not use rate)
 * - 'histogram' | 'summary' | anything else or missing -> undefined (inconclusive; caller should fall back to existing logic)
 *
 * @param metadata Prometheus metrics metadata item for a specific metric name
 * @returns true if counter, false if definitively not a counter, otherwise undefined.
 */
export function computeIsCounterFromMetadata(
  metadata?: PromMetricsMetadataItem
): boolean | undefined {
  const type = metadata?.type?.toLowerCase();
  if (!type) {
    return undefined;
  }

  if (type === 'counter') {
    return true;
  }

  if (type === 'gauge') {
    return false;
  }

  // Unknown/untyped or unsupported types -> inconclusive
  return undefined;
}

/**
 * Fetches Prometheus metadata via DataTrail and applies `computeIsCounterFromMetadata`.
 * Errors and missing metadata are treated as inconclusive (undefined) so that callers
 * can preserve heuristic behavior.
 *
 * @param metric Metric name
 * @param dataTrail Scene's DataTrail to access datasource helper/cache
 * @returns Promise resolving to the same mapping as `computeIsCounterFromMetadata`.
 */
export async function getIsCounterFromMetadata(
  metric: string,
  dataTrail: DataTrail
): Promise<boolean | undefined> {
  try {
    const metadata = await dataTrail.getMetadataForMetric(metric);
    return computeIsCounterFromMetadata(metadata);
  } catch {
    return undefined;
  }
}


