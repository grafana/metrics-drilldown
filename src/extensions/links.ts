// CAUTION: Imports in this file will contribute to the module.tsx bundle size
import {
  PluginExtensionPoints,
  type PluginExtensionAddedLinkConfig,
  type PluginExtensionPanelContext,
} from '@grafana/data';
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

      const query = parsePromQueryRegex(expr);

      const timeRange =
        'timeRange' in context &&
        typeof context.timeRange === 'object' &&
        context.timeRange !== null &&
        'from' in context.timeRange &&
        'to' in context.timeRange
          ? (context.timeRange as { from: string; to: string })
          : undefined;

      const params = appendUrlParameters([
        [UrlParameters.Metric, query.metric],
        [UrlParameters.TimeRangeFrom, timeRange?.from],
        [UrlParameters.TimeRangeTo, timeRange?.to],
        [UrlParameters.DatasourceId, datasource.uid],
        ...query.labelFilters.map(
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

type PromLabelFilter = { label: string; op: string; value: string };
type ParsedPromQuery = { metric: string | undefined; labelFilters: PromLabelFilter[]; query: string };

/**
 * TODO: Replace this with a `@grafana/prometheus` solution after
 * https://github.com/grafana/grafana/issues/99111 is resolved.
 * This will allow us to parse PromQL queries in a more robust way,
 * without compromising our `module.tsx` bundle size.
 *
 * Parses a PromQL query string using regular expressions to extract the
 * metric name and label filters. This is a lightweight alternative to
 * heavier parsing libraries.
 *
 * Note: This parser is simplified and may not cover all complex PromQL syntaxes,
 * especially nested functions or advanced selectors. It prioritizes common cases.
 */
export function parsePromQueryRegex(query: string): ParsedPromQuery {
  let metric: string | undefined = undefined;
  const labelFilters: PromLabelFilter[] = [];
  const trimmedQuery = query.trim();

  // First, try to find the metric name and labels in the most common format
  const queryMatch = trimmedQuery.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s*(?:\{([^}]*)\})?/);

  if (queryMatch) {
    const potentialMetric = queryMatch[1];
    const labelsContent = queryMatch[2];

    // Check if this is a function call
    const nextCharIndex = queryMatch[0].length;
    const nextChar = trimmedQuery[nextCharIndex];
    const isLikelyFunctionCall = nextChar === '(';

    if (!(isLikelyFunctionCall && knownKeywords.has(potentialMetric))) {
      metric = potentialMetric;
    }

    // Parse labels if content exists
    if (labelsContent) {
      parseLabels(labelsContent, labelFilters);
    }
  }

  // If we didn't find a metric or it was a function call, try to find the metric inside the query
  if (!metric) {
    // Look for the first occurrence of a metric pattern that's not a known keyword
    const metricPattern = /([a-zA-Z_:][a-zA-Z0-9_:]*)\s*(?:\{([^}]*)\})?/g;
    let match;
    while ((match = metricPattern.exec(trimmedQuery)) !== null) {
      const potentialMetric = match[1];
      const labelsContent = match[2];

      if (!knownKeywords.has(potentialMetric)) {
        metric = potentialMetric;
        if (labelsContent) {
          parseLabels(labelsContent, labelFilters);
        }
        break;
      }
    }
  }

  return { metric, labelFilters, query };
}

function parseLabels(labelsContent: string, labelFilters: PromLabelFilter[]): void {
  const labelParts = labelsContent.split(',');
  const labelRegex = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([=!~]+)\s*"((?:[^"\\]|\\.)*)"\s*$/;

  labelParts.forEach((part) => {
    if (part.trim() === '') {
      return;
    }
    const match = part.match(labelRegex);
    if (match) {
      const unescapedValue = match[3].replace(/\\(.)/g, '$1');
      labelFilters.push({ label: match[1], op: match[2], value: unescapedValue });
    } else {
      logger.warn(`[Metrics Drilldown] Could not parse label part: "${part}" for labels: ${labelsContent}`);
    }
  });
}

const knownKeywords = new Set([
  'rate',
  'increase',
  'sum',
  'avg',
  'count',
  'max',
  'min',
  'stddev',
  'stdvar',
  'topk',
  'bottomk',
  'quantile',
  'histogram_quantile',
  'label_replace',
  'label_join',
  'vector',
  'scalar',
  'time',
  'timestamp',
  'month',
  'year',
  'day_of_month',
  'day_of_week',
  'days_in_month',
  'hour',
  'minute',
  'by',
  'without',
  'on',
  'ignoring',
  'group_left',
  'group_right',
]);
