// CAUTION: Imports in this file will contribute to the module.tsx bundle size
import {
  PluginExtensionPoints,
  type PluginExtensionAddedLinkConfig,
} from '@grafana/data';

import { appendUrlParameters, createAppUrl, UrlParameters } from './links';
import { ROUTES } from '../shared/constants/routes';

const PROMETHEUS_DATASOURCE_TYPES = ['prometheus', 'mimir', 'cortex', 'thanos'];

function isPrometheusCompatible(datasourceType?: string): boolean {
  return datasourceType ? PROMETHEUS_DATASOURCE_TYPES.includes(datasourceType) : false;
}

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

function getDatasourceCapabilities(datasourceType: string): string[] {
  const capabilities: Record<string, string[]> = {
    prometheus: ['native_histograms', 'exemplars', 'recording_rules'],
    mimir: ['native_histograms', 'exemplars', 'recording_rules', 'multi_tenancy'],
    cortex: ['exemplars', 'recording_rules'],
    thanos: ['exemplars', 'recording_rules', 'downsampling'],
  };
  return capabilities[datasourceType] || [];
}

export function createDatasourceUrl(datasourceUid: string, route: string = ROUTES.Drilldown): string {
  const params = appendUrlParameters([
    [UrlParameters.DatasourceId, datasourceUid],
  ]);
  return createAppUrl(route, params);
}
interface DataSourceConfigContext {
  dataSource?: {
    type: string;
    uid: string;
    name: string;
  };
}

export const datasourceConfigLinkConfigs: PluginExtensionAddedLinkConfig[] = [
  {
    title: 'Open in Metrics Drilldown',
    description: 'Browse metrics in Grafana Metrics Drilldown',
    targets: [PluginExtensionPoints.DataSourceConfigActions, PluginExtensionPoints.DataSourceConfigStatus],
    icon: 'drilldown',
    category: 'metrics-drilldown',
    path: createAppUrl(ROUTES.Drilldown),
    configure: (context: DataSourceConfigContext | undefined) => {
      // Validate context and datasource
      if (!context?.dataSource?.type || !context?.dataSource?.uid) {
        return undefined;
      }

      // Only show for Prometheus-compatible datasources
      if (!isPrometheusCompatible(context.dataSource.type)) {
        return undefined; // Hide the extension for non-compatible datasources
      }

      // Return dynamic path and description based on datasource type
      return {
        path: createDatasourceUrl(context.dataSource.uid),
        description: getDescriptionForDatasource(context.dataSource.type)
      };
    },
  }
];

// Export for testing
export {
  getDatasourceCapabilities,
  getDescriptionForDatasource,
  isPrometheusCompatible,
  PROMETHEUS_DATASOURCE_TYPES
};
