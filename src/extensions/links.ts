import {
  PluginExtensionPoints,
  type PluginExtensionAddedLinkConfig,
  type PluginExtensionPanelContext,
} from '@grafana/data';
import { type PromQuery } from '@grafana/prometheus';
import { type DataQuery } from '@grafana/schema';

import { getQueryMetrics } from 'Integrations/getQueryMetrics';
import { VAR_DATASOURCE, VAR_FILTERS, VAR_METRIC } from 'shared';

import { ROUTES } from '../constants';
import pluginJson from '../plugin.json';

const PRODUCT_NAME = 'Grafana Metrics Drilldown';
const title = `Open in ${PRODUCT_NAME}`;
const description = `Open current query in the ${PRODUCT_NAME} view`;
const category = 'metrics-drilldown';

export const linkConfigs: PluginExtensionAddedLinkConfig[] = [
  {
    targets: [PluginExtensionPoints.DashboardPanelMenu],
    title,
    description,
    category,
    path: createAppUrl(ROUTES.Trail),
    configure: (context) => {
      if (typeof context === 'undefined' || !('pluginId' in context) || context.pluginId !== 'timeseries') {
        return;
      }

      const queries = (context as PluginExtensionPanelContext).targets.filter(isPromQuery);

      if (!queries?.length) {
        return;
      }

      const datasource = queries[0].datasource;

      if (!(datasource?.type === 'prometheus')) {
        return;
      }

      const queryMetrics = getQueryMetrics(queries.map((q) => q.expr));

      const timeRange =
        'timeRange' in context &&
        typeof context.timeRange === 'object' &&
        context.timeRange !== null &&
        'from' in context.timeRange &&
        'to' in context.timeRange
          ? (context.timeRange as { from: string; to: string })
          : undefined;

      const params = setUrlParameters({
        [UrlParameters.Metric]: queryMetrics[0].metric,
        [UrlParameters.Filters]: queryMetrics[0].labelFilters.map((f) => f.toString()).join(','),
        [UrlParameters.TimeRangeFrom]: timeRange?.from,
        [UrlParameters.TimeRangeTo]: timeRange?.to,
        [UrlParameters.DatasourceId]: datasource.uid,
      });

      return {
        path: createAppUrl(ROUTES.Trail, params),
      };
    },
  },
];

export function createAppUrl(route: string, urlParams?: URLSearchParams): string {
  return `/a/${pluginJson.id}/${route}${urlParams ? `?${urlParams.toString()}` : ''}`;
}

export const UrlParameters = {
  TimeRangeFrom: 'from',
  TimeRangeTo: 'to',
  Metric: VAR_METRIC,
  DatasourceId: `var-${VAR_DATASOURCE}`,
  Filters: `var-${VAR_FILTERS}`,
} as const;

export type UrlParameterType = (typeof UrlParameters)[keyof typeof UrlParameters];

export function setUrlParameters(
  params: Partial<Record<UrlParameterType, string>>,
  initialParams?: URLSearchParams
): URLSearchParams {
  const searchParams = new URLSearchParams(initialParams?.toString() ?? location.search);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  return searchParams;
}

function isPromQuery(model: DataQuery): model is PromQuery {
  return 'expr' in model;
}
