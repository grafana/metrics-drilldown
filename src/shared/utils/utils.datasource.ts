import { type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';
import { type PrometheusDatasource } from '@grafana/prometheus';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';

import { logger } from '../logger/logger';
export type DataSource = DataSourceInstanceSettings<DataSourceJsonData>;

// This regex matches Grafana developed Prometheus data sources that are compatible with the vanilla Prometheus data source
const PROMETHEUS_DATA_SOURCE_REGEX = /^grafana-[0-9a-z]+prometheus-datasource$/;

/**
 * Helper function to determine if a datasource is a Prometheus datasource
 */
export function isPrometheusDataSource(input: unknown): input is PrometheusDatasource {
  return (
    typeof input === 'object' &&
    input !== null &&
    'type' in input &&
    typeof input.type === 'string' &&
    (input.type === 'prometheus' || PROMETHEUS_DATA_SOURCE_REGEX.test(input.type)) &&
    'uid' in input &&
    typeof input.uid === 'string'
  );
}

type DataSourceType = 'prometheus' | 'loki';

/**
 * Fetches and caches healthy data sources
 */
export class DataSourceFetcher {
  private readonly pendingRequests = new Map<DataSourceType, Promise<DataSource[]>>();
  private readonly cache = new Map<DataSourceType, DataSource[]>();

  /**
   * Retrieves healthy data sources of the specified type
   * Results are cached indefinitely until the `DataSourceFetcher` is destroyed
   *
   * @param type - The type of data source to retrieve ('prometheus' or loki)
   * @returns Array of healthy data sources
   */
  public async getHealthyDataSources(type: DataSourceType, limit = 25): Promise<DataSource[]> {
    // Check if we have cached results
    const cachedDataSources = this.cache.get(type);
    if (cachedDataSources?.length) {
      return cachedDataSources;
    }

    // If there's already a pending request for this type, wait for it
    let pendingRequest = this.pendingRequests.get(type);
    if (!pendingRequest) {
      pendingRequest = this.fetchHealthyDataSources(type, limit).finally(() => {
        // Clean up the pending request after it completes
        this.pendingRequests.delete(type);
      });
      this.pendingRequests.set(type, pendingRequest);
    }

    // Wait for the request to complete and update cache
    const dataSources = await pendingRequest;
    this.cache.set(type, dataSources);

    return dataSources;
  }

  /**
   * Fetches healthy data sources of the specified type
   */
  private async fetchHealthyDataSources(type: DataSourceType, limit: number): Promise<DataSource[]> {
    const allDataSourcesOfType = [
      ...getDataSourceSrv().getList({
        logs: true,
        type,
        filter: (ds) => ds.uid !== 'grafana',
      }),
    ]
      .sort((a, b) => {
        // Default data source should be first in the list
        if (a.isDefault && !b.isDefault) {
          return -1;
        }
        if (!a.isDefault && b.isDefault) {
          return 1;
        }
        return 0;
      })
      .slice(0, limit);

    const healthyDataSources: DataSource[] = [];
    const unhealthyDataSources: DataSource[] = [];

    await Promise.all(
      allDataSourcesOfType.map(async (ds) => {
        try {
          const health = await this.performHealthCheckWithTimeout(ds.uid);

          if (health?.status === 'OK') {
            healthyDataSources.push(ds);
          } else {
            unhealthyDataSources.push(ds);
          }
        } catch {
          unhealthyDataSources.push(ds);
        }
      })
    );

    if (unhealthyDataSources.length > 0) {
      logger.warn(
        `Found ${unhealthyDataSources.length} unhealthy ${type} data sources: ${unhealthyDataSources
          .map((ds) => ds.name)
          .join(', ')}`
      );
    }

    return healthyDataSources;
  }

  /**
   * Performs a health check with a 3-second timeout.
   * Data sources that don't respond within 3 seconds are considered unhealthy.
   *
   * @param uid - The data source UID to check
   * @returns Health check response with status 'OK' or 'TIMEOUT'
   */
  private async performHealthCheckWithTimeout(uid: string): Promise<{ status: string }> {
    const HEALTH_CHECK_TIMEOUT_MS = 3000;
    const abortController = new AbortController();

    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, HEALTH_CHECK_TIMEOUT_MS);

    try {
      const health = await getBackendSrv().get(`/api/datasources/uid/${uid}/health`, undefined, undefined, {
        showSuccessAlert: false,
        showErrorAlert: false,
        abortSignal: abortController.signal,
      });
      clearTimeout(timeoutId);
      return health;
    } catch (error) {
      clearTimeout(timeoutId);
      // If the request was aborted due to timeout, return TIMEOUT status
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { status: 'TIMEOUT' };
      }
      // Re-throw other errors to be handled by the caller
      throw error;
    }
  }
}

let dataSourceFetcherSingleton: DataSourceFetcher | undefined;

export function getDataSourceFetcher(): DataSourceFetcher {
  if (!dataSourceFetcherSingleton) {
    dataSourceFetcherSingleton = new DataSourceFetcher();
  }

  return dataSourceFetcherSingleton;
}
