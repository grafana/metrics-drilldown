import { getBackendSrv, type BackendSrvRequest } from '@grafana/runtime';
import { sceneGraph, type SceneObject } from '@grafana/scenes';

import { VAR_DATASOURCE } from 'shared';
import { logger } from 'tracking/logger/logger';

interface TrueTotalCache {
  [key: string]: {
    count: number;
    timestamp: number;
    timeRange: string;
  };
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
const REQUEST_OPTIONS: Partial<BackendSrvRequest> = {
  showSuccessAlert: false,
  showErrorAlert: false,
} as const;

/**
 * Service to get unlimited metric counts via direct Prometheus API calls.
 * Bypasses Grafana's series limits to show true total available metrics.
 */
export class TrueTotalService {
  private static cache: TrueTotalCache = {};

  /**
   * Get the true total count of metrics from Prometheus directly
   * @param sceneObject - Scene object to get datasource and time range from
   * @returns Promise that resolves to the total count of available metrics
   */
  public static async getTrueTotalCount(sceneObject: SceneObject): Promise<number> {
    try {
      // Get datasource UID
      const dsVariable = sceneGraph.findByKey(sceneObject, VAR_DATASOURCE);
      const dsUid = (dsVariable?.state as any)?.value as string;
      
      if (!dsUid) {
        logger.warn('TrueTotalService: No datasource UID found');
        return 0;
      }

      // Get time range for cache key
      const timeRange = sceneGraph.getTimeRange(sceneObject).state.value;
      const timeRangeKey = `${timeRange.from}-${timeRange.to}`;
      const cacheKey = `${dsUid}-${timeRangeKey}`;

      // Check cache first
      const cached = this.cache[cacheKey];
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.count;
      }

      // Make direct API call to Prometheus via Grafana's datasource proxy
      // This bypasses Grafana's series limits by calling the API directly
      const response = await getBackendSrv().get<any>(
        `/api/datasources/uid/${dsUid}/resources/api/v1/label/__name__/values`,
        {
          start: this.convertTimeToUnixTimestamp(timeRange.from),
          end: this.convertTimeToUnixTimestamp(timeRange.to),
          // No match[] parameter means get ALL metric names without limits
        },
        `grafana-metricsdrilldown-true-total-${dsUid}`,
        REQUEST_OPTIONS
      );

      // Extract metric names from response
      const metricNames = Array.isArray(response) ? response : response.data || [];
      const totalCount = metricNames.length;

      // Cache the result
      this.cache[cacheKey] = {
        count: totalCount,
        timestamp: Date.now(),
        timeRange: timeRangeKey,
      };

      logger.info(`TrueTotalService: Got ${totalCount} total metrics from ${dsUid}`);
      return totalCount;

    } catch (error) {
      logger.error(error as Error, ['TrueTotalService: Failed to fetch true total count']);
      return 0;
    }
  }

  /**
   * Clear the cache for a specific datasource or all caches
   * @param dsUid - Optional datasource UID to clear, if not provided clears all
   */
  public static clearCache(dsUid?: string) {
    if (dsUid) {
      // Clear cache entries for specific datasource
      Object.keys(this.cache).forEach(key => {
        if (key.startsWith(dsUid)) {
          delete this.cache[key];
        }
      });
    } else {
      // Clear all cache
      this.cache = {};
    }
  }

  /**
   * Convert Grafana time format to Unix timestamp
   * @param time - Grafana time value (could be string, DateTime, or number)
   * @returns Unix timestamp in seconds
   */
  private static convertTimeToUnixTimestamp(time: any): number {
    // Handle different time format types that Grafana uses
    
    // If it's already a number (Unix timestamp), convert to seconds if needed
    if (typeof time === 'number') {
      // If it looks like milliseconds (> year 2000 in seconds), convert to seconds
      return time > 946684800 ? Math.floor(time / 1000) : time;
    }
    
    // If it's a DateTime object with valueOf method
    if (time && typeof time.valueOf === 'function') {
      return Math.floor(time.valueOf() / 1000);
    }
    
    // If it's a string
    if (typeof time === 'string') {
      if (time === 'now') {
        return Math.floor(Date.now() / 1000);
      }
      
      // Handle relative times like "now-1h"
      if (time.startsWith('now-')) {
        const now = Date.now();
        const duration = time.substring(4); // Remove "now-"
        
        // Simple parsing for common cases
        if (duration.endsWith('h')) {
          const hours = parseInt(duration, 10);
          return Math.floor((now - hours * 60 * 60 * 1000) / 1000);
        }
        if (duration.endsWith('d')) {
          const days = parseInt(duration, 10);
          return Math.floor((now - days * 24 * 60 * 60 * 1000) / 1000);
        }
      }
      
      // Try to parse as ISO date
      try {
        return Math.floor(new Date(time).getTime() / 1000);
      } catch {
        // Fallback to current time if date parsing fails
        return Math.floor(Date.now() / 1000);
      }
    }
    
    // Fallback to current time
    return Math.floor(Date.now() / 1000);
  }
}
