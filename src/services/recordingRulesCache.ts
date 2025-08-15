import { type DataSourceApi } from '@grafana/data';

import { logger } from '../tracking/logger/logger';
import {
  extractRecordingRulesFromPrometheusRuleGroups,
  fetchPrometheusRuleGroups,
  type ExtractedPrometheusRule,
} from '../utils/utils.recording-rules';

interface CacheEntry {
  data: Map<string, ExtractedPrometheusRule>;
  timestamp: number;
  datasourceUid: string;
  datasourceName: string;
}

type RulesMap = Map<string, ExtractedPrometheusRule>;

/**
 * Service for caching Prometheus recording rules data in memory.
 *
 * @remarks The `recordingRulesCache` service provides efficient per-datasource caching for
 * Prometheus recording rules data, to avoid expensive API calls. Recording rules payloads can
 * easily be tens or hundreds of kilobytes.
 *
 * @remarks
 * By leveraging module-level caching, this cache persists beyond component lifecycle but
 * clears on browser refresh. This allows us to leverage the cache in the context of exposed
 * components, such as the `EmbeddedMetricsReducer` component.
 */
class RecordingRulesCache {
  readonly #cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_CACHE_SIZE = 3; // Maximum number of datasources to cache

  /**
   * Get a specific recording rule by name for a datasource, using cache if available and fresh.
   *
   * @param metricName - The name of the recording rule to find
   * @param datasourceSettings - The datasource settings
   * @param ttlMs - Time-to-live in milliseconds (default: 10 minutes)
   * @returns Promise resolving to the recording rule or null if not found
   */
  public async getRecordingRule(
    metricName: string,
    datasourceSettings: DataSourceApi,
    ttlMs: number = this.DEFAULT_TTL_MS
  ): Promise<ExtractedPrometheusRule | null> {
    const recordingRulesMap = await this.#getRecordingRulesMap(datasourceSettings, ttlMs);
    return recordingRulesMap.get(metricName) || null;
  }

  /**
   * Get all recording rules for a datasource as a Map, using cache if available and fresh.
   *
   * @param datasourceSettings - The datasource settings
   * @param ttlMs - Time-to-live in milliseconds (default: 10 minutes)
   * @returns Promise resolving to Map of recording rules indexed by name
   */
  async #getRecordingRulesMap(
    datasourceSettings: DataSourceApi,
    ttlMs: number = this.DEFAULT_TTL_MS
  ): Promise<RulesMap> {
    const cacheKey = datasourceSettings.uid;
    const now = Date.now();

    // Check if we have valid cached data
    const cached = this.#cache.get(cacheKey);
    if (cached && RecordingRulesCache.isItemFresh(cached, ttlMs, now)) {
      return cached.data;
    }

    // Cache miss or expired - fetch fresh data
    try {
      const ruleGroups = await fetchPrometheusRuleGroups(datasourceSettings);
      const extractedRules = extractRecordingRulesFromPrometheusRuleGroups(ruleGroups, datasourceSettings);

      // Create Map indexed by rule name for O(1) lookups
      const recordingRulesMap = new Map<string, ExtractedPrometheusRule>();
      extractedRules.forEach((rule) => {
        recordingRulesMap.set(rule.name, rule);
      });

      // Store in cache
      this.#setCacheEntry(cacheKey, {
        data: recordingRulesMap,
        timestamp: now,
        datasourceUid: datasourceSettings.uid,
        datasourceName: datasourceSettings.name,
      });

      return recordingRulesMap;
    } catch (error) {
      logger.error(
        new Error(
          `Failed to fetch recording rules for datasource ${datasourceSettings.name}. ${
            cached && 'Returning stale data from cache instead. '
          } Error: ${error instanceof Error ? error.message : String(error)}`
        )
      );

      // If fetch fails and we have stale cached data, return it
      if (cached) {
        return cached.data;
      }

      // No cached data available, return empty Map
      return new Map();
    }
  }

  #setCacheEntry(key: string, entry: CacheEntry): void {
    // Implement simple LRU eviction if cache is full
    if (this.#cache.size >= this.MAX_CACHE_SIZE && !this.#cache.has(key)) {
      const oldestKey = this.#cache.keys().next().value;
      if (oldestKey) {
        this.#cache.delete(oldestKey);
      }
    }

    this.#cache.set(key, entry);
  }

  static isItemFresh(entry: CacheEntry, ttlMs: number, now: number): boolean {
    return now - entry.timestamp < ttlMs;
  }
}

// Export singleton instance
export const recordingRulesCache = new RecordingRulesCache();
