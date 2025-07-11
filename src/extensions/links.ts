// CAUTION: Imports in this file will contribute to the module.tsx bundle size
import {
  PluginExtensionPoints,
  type PluginExtensionAddedLinkConfig,
  type PluginExtensionPanelContext,
} from '@grafana/data';
import { buildVisualQueryFromString } from '@grafana/prometheus';
import { type DataQuery } from '@grafana/schema';

import { PLUGIN_BASE_URL, ROUTES } from '../constants';
import { logger } from '../tracking/logger/logger';

const PRODUCT_NAME = 'Grafana Metrics Drilldown';
const title = `Open in ${PRODUCT_NAME}`;
const description = `Open current query in the ${PRODUCT_NAME} view`;
const category = 'metrics-drilldown';
const icon = 'gf-prometheus';

export const linkConfigs: PluginExtensionAddedLinkConfig[] = [
  {
    targets: [PluginExtensionPoints.DashboardPanelMenu, PluginExtensionPoints.ExploreToolbarAction],
    title,
    description,
    icon,
    category,
    path: createAppUrl(ROUTES.Drilldown),
    configure: (context) => {
      if (typeof context === 'undefined') {
        return;
      }

      if ('pluginId' in context && context.pluginId !== 'timeseries') {
        return;
      }

      const queries = (context as PluginExtensionPanelContext).targets.filter(isPromQuery);

      if (!queries?.length) {
        return;
      }

      const { datasource, expr } = queries[0];

      if (!expr || datasource?.type !== 'prometheus') {
        return;
      }

      const visualQuery = buildVisualQueryFromString(expr);

      const { errors, query } = visualQuery;
      if (errors.length > 0) {
        // parsing prom query expressions does not necessarily mean the query is invalid so we can continue
        logger.error(new Error(`[Metrics Drilldown] Error building visual query: ${errors.join(', ')}`));
      }
      // for future reference we can add operations to the url 
      const { metric, labels, /* operations*/ } = query;

      const timeRange =
        'timeRange' in context &&
        typeof context.timeRange === 'object' &&
        context.timeRange !== null &&
        'from' in context.timeRange &&
        'to' in context.timeRange
          ? (context.timeRange as { from: string; to: string })
          : undefined;

      const params = appendUrlParameters([
        [UrlParameters.Metric, metric],
        [UrlParameters.TimeRangeFrom, timeRange?.from],
        [UrlParameters.TimeRangeTo, timeRange?.to],
        [UrlParameters.DatasourceId, datasource.uid],
        ...labels.map(
          (f) => [UrlParameters.Filters, `${f.label}${f.op}${f.value}`] as [UrlParameterType, string]
        ),
      ]);

      const pathToMetricView = createAppUrl(ROUTES.Drilldown, params);

      return {
        path: pathToMetricView,
      };
    },
  },
];

export function createAppUrl(route: string, urlParams?: URLSearchParams): string {
  const urlParamsAsString = urlParams ? `?${urlParams.toString()}` : '';
  return `${PLUGIN_BASE_URL}/${route}${urlParamsAsString}`;
}

// We can't use `src/shared.ts` vars here because of the impacts of its imports on the module.tsx bundle size
export const UrlParameters = {
  TimeRangeFrom: 'from',
  TimeRangeTo: 'to',
  Metric: 'metric',
  DatasourceId: `var-ds`,
  Filters: `var-filters`,
} as const;

export type UrlParameterType = (typeof UrlParameters)[keyof typeof UrlParameters];

export function appendUrlParameters(
  params: Array<[UrlParameterType, string | undefined]>,
  initialParams?: URLSearchParams
): URLSearchParams {
  const searchParams = new URLSearchParams(initialParams?.toString());

  params.forEach(([key, value]) => {
    if (value) {
      searchParams.append(key, value);
    }
  });

  return searchParams;
}

type PromQuery = DataQuery & { expr: string };

function isPromQuery(query: DataQuery): query is PromQuery {
  return 'expr' in query;
}
