// CAUTION: Imports in this file will contribute to the module.tsx bundle size
import { PluginExtensionPoints, type PluginExtensionAddedLinkConfig } from '@grafana/data';

import { appendUrlParameters, createAppUrl, UrlParameters } from './links';
import { ROUTES } from '../shared/constants/routes';
import { isPrometheusDataSource } from '../shared/utils/utils.datasource';

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
      if (!isPrometheusDataSource(context.dataSource)) {
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
