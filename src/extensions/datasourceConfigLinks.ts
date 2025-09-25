// CAUTION: Imports in this file will contribute to the module.tsx bundle size
import { PluginExtensionPoints, type PluginExtensionAddedLinkConfig } from '@grafana/data';

import { appendUrlParameters, createAppUrl, UrlParameters } from './links';
import { ROUTES } from '../shared/constants/routes';

export const PROMETHEUS_DATASOURCE_TYPES = ['prometheus', 'grafana-amazonprometheus-datasource'];

export function isPrometheusCompatible(datasourceType?: string): boolean {
  return datasourceType ? PROMETHEUS_DATASOURCE_TYPES.includes(datasourceType) : false;
}

export function createDatasourceUrl(datasourceUid: string, route: string = ROUTES.Drilldown): string {
  const params = appendUrlParameters([[UrlParameters.DatasourceId, datasourceUid]]);
  return createAppUrl(route, params);
}

interface DataSourceConfigContext {
  dataSource?: {
    type: string;
    uid: string;
    name: string;
  };
}

export const EXTENSION_DESCRIPTION = `Browse metrics in Grafana Metrics Drilldown`;

export const datasourceConfigLinkConfigs: PluginExtensionAddedLinkConfig[] = [
  {
    title: 'Open in Metrics Drilldown',
    description: EXTENSION_DESCRIPTION,
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
        description: EXTENSION_DESCRIPTION,
      };
    },
  },
];
