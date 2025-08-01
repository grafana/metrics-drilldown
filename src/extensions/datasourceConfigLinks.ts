// CAUTION: Imports in this file will contribute to the module.tsx bundle size
import {
  PluginExtensionPoints,
  type PluginExtensionAddedLinkConfig,
} from '@grafana/data';

import { ROUTES } from '../constants';
import { appendUrlParameters, createAppUrl, UrlParameters } from './links';

const PRODUCT_NAME = 'Grafana Metrics Drilldown';

// List of Prometheus-compatible datasource types
const PROMETHEUS_DATASOURCE_TYPES = ['prometheus', 'mimir', 'cortex', 'thanos'];

/**
 * Check if a datasource is Prometheus-compatible
 */
function isPrometheusCompatible(datasourceType?: string): boolean {
  return datasourceType ? PROMETHEUS_DATASOURCE_TYPES.includes(datasourceType) : false;
}

/**
 * Get description based on datasource capabilities
 */
function getDescriptionForDatasource(datasourceType: string): string {
  const capabilities = getDatasourceCapabilities(datasourceType);

  let description = 'Browse metrics without writing PromQL queries';

  if (capabilities.includes('native_histograms')) {
    description += '. Includes native histogram support';
  }
  if (capabilities.includes('exemplars')) {
    description += '. View trace exemplars';
  }

  return description;
}

/**
 * Get datasource capabilities based on type
 */
function getDatasourceCapabilities(datasourceType: string): string[] {
  const capabilities: Record<string, string[]> = {
    prometheus: ['native_histograms', 'exemplars', 'recording_rules'],
    mimir: ['native_histograms', 'exemplars', 'recording_rules', 'multi_tenancy'],
    cortex: ['exemplars', 'recording_rules'],
    thanos: ['exemplars', 'recording_rules', 'downsampling'],
  };
  return capabilities[datasourceType] || [];
}

/**
 * Create URL for datasource-specific navigation
 */
export function createDatasourceUrl(datasourceUid: string, route: string = ROUTES.Drilldown): string {
  const params = appendUrlParameters([
    [UrlParameters.DatasourceId, datasourceUid],
  ]);
  return createAppUrl(route, params);
}

// Type definition for datasource configuration context
interface DataSourceConfigContext {
  dataSource?: {
    type: string;
    uid: string;
    name: string;
  };
}



export const datasourceConfigLinkConfigs: PluginExtensionAddedLinkConfig[] = [
  {
    title: 'Explore Metrics',
    description: `Browse metrics in ${PRODUCT_NAME}`,
    category: 'metrics-drilldown',
    icon: 'chart-line',
    path: createAppUrl(ROUTES.Drilldown),
    targets: [PluginExtensionPoints.DataSourceConfig],
    configure: (context: DataSourceConfigContext | undefined) => {
      if (!context?.dataSource?.type || !context?.dataSource?.uid) {
        return undefined;
      }

      const { type: datasourceType, uid: datasourceUid } = context.dataSource;

      // Only show for Prometheus-compatible datasources
      if (!isPrometheusCompatible(datasourceType)) {
        return undefined;
      }

      // Return dynamic path with datasource UID and custom description
      return {
        path: createDatasourceUrl(datasourceUid),
        description: getDescriptionForDatasource(datasourceType),
      };
    },
  },
];

// Export for testing
export {
  getDatasourceCapabilities,
  getDescriptionForDatasource,
  isPrometheusCompatible,
  PROMETHEUS_DATASOURCE_TYPES
};
