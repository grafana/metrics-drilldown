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
  {
    targets: ['grafana-metricsdrilldown-app/grafana-assistant-app/navigateToDrilldown/v0-alpha'],
    title: 'Navigate to metrics drilldown',
    description: 'Build a url path to the metrics drilldown',
    path: createAppUrl(ROUTES.Drilldown),
    configure: (context) => {
      if (typeof context === 'undefined') {
        return;
      }

      const navigateToMetrics = (context as MetricsDrilldownContext).navigateToMetrics;
      const params = navigateToMetrics ? buildNavigateToMetricsParams(context as MetricsDrilldownContext) : undefined;

      return {
        path: createAppUrl(ROUTES.Drilldown, params),
      };
    },
  },
];

// Type for the metrics drilldown context from Grafana Assistant
export type MetricsDrilldownContext = {
  navigateToMetrics: boolean;
  datasource_uid: string;
  label_filters?: string[];
  metric?: string;
  start?: string;
  end?: string;
};

export function buildNavigateToMetricsParams(context: MetricsDrilldownContext): URLSearchParams {
  const { metric, start, end, datasource_uid, label_filters } = context;

  const filters = label_filters ?? [];
  // Use the structured context data to build parameters
  return appendUrlParameters([
    [UrlParameters.Metric, metric],
    [UrlParameters.TimeRangeFrom, start],
    [UrlParameters.TimeRangeTo, end],
    [UrlParameters.DatasourceId, datasource_uid],
    ...filters.map(
      (filter) => [UrlParameters.Filters, filter] as [UrlParameterType, string]
    ),
  ]);
}

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
 * Checks if a potential metric name is a known PromQL function/keyword
 */
function isKnownKeyword(name: string): boolean {
  return knownKeywords.has(name);
}

/**
 * Tries to extract a metric name and labels from the beginning of a query
 */
function extractMainMetric(query: string): { metric: string | undefined; labelFilters: PromLabelFilter[] } {
  // Regex to match a PromQL metric name and optional label selectors:
  // - First capture group: metric name (must start with letter/underscore/colon, followed by alphanumeric/underscore/colon)
  // - Second (optional) capture group: contents inside curly braces (label selectors)
  // The pattern looks for this at the beginning of the string (^) to identify the main metric
  const queryMatch = query.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s*(?:\{([^}]*)\})?/);

  if (!queryMatch) {
    return { metric: undefined, labelFilters: [] };
  }

  const potentialMetric = queryMatch[1];
  const labelsContent = queryMatch[2];
  const labelFilters = parseLabels(labelsContent);

  // Check if this is a function call
  const nextCharIndex = queryMatch[0].length;
  const nextChar = query[nextCharIndex];
  const isLikelyFunctionCall = nextChar === '(';

  // If it's a function call and a known keyword, don't treat it as a metric
  if (isLikelyFunctionCall && isKnownKeyword(potentialMetric)) {
    return { metric: undefined, labelFilters };
  }

  return { metric: potentialMetric, labelFilters };
}

/**
 * Searches for metrics within a query, skipping known PromQL functions
 */
function findMetricWithinQuery(query: string): { metric: string | undefined; labelFilters: PromLabelFilter[] } {
  // Regex similar to the one used for extractMainMetric, but with global flag (g) to find all matches in the query:
  // - First capture group: metric name pattern (letter/underscore/colon followed by alphanumeric/underscore/colon)
  // - Second capture group: optional label selector contents inside curly braces
  // Unlike extractMainMetric regex, this doesn't anchor to the beginning of the string, allowing it to find metrics anywhere
  const metricPattern = /([a-zA-Z_:][a-zA-Z0-9_:]*)\s*(?:\{([^}]*)\})?/g;
  let match;

  // Iteratively search through the query for all metric patterns
  // exec() returns the next match and advances the regex's lastIndex property
  // This loop continues until no more matches are found (exec returns null)
  while ((match = metricPattern.exec(query)) !== null) {
    const potentialMetric = match[1];
    const labelsContent = match[2];

    if (!isKnownKeyword(potentialMetric)) {
      return {
        metric: potentialMetric,
        labelFilters: parseLabels(labelsContent),
      };
    }
  }

  return { metric: undefined, labelFilters: [] };
}

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
  const trimmedQuery = query.trim();

  // First try to find a metric at the beginning of the query
  let { metric, labelFilters } = extractMainMetric(trimmedQuery);

  // If no metric found at the beginning, search within the query
  if (!metric) {
    const innerResult = findMetricWithinQuery(trimmedQuery);
    metric = innerResult.metric;
    labelFilters = [...labelFilters, ...innerResult.labelFilters];
  }

  return { metric, labelFilters, query };
}

function parseLabels(labelsContent: string): PromLabelFilter[] {
  if (!labelsContent) {
    return [];
  }

  const labelFiltersToAdd: PromLabelFilter[] = [];
  const labelParts = labelsContent.split(',');

  // Regex to parse Prometheus label filters in the format 'label=~"value"':
  // - First capture group: label name (must start with a letter or underscore, followed by word chars)
  // - Second capture group: operator (=, !=, =~, !~)
  // - Third capture group: quoted value (handles escaped characters)
  const labelRegex = /^\s*([a-zA-Z_]\w*)\s*([=!~]+)\s*"((?:[^"\\]|\\.)*)"\s*$/;

  labelParts.forEach((part) => {
    if (part.trim() === '') {
      return;
    }
    const match = part.match(labelRegex);
    if (match) {
      const unescapedValue = match[3].replace(/\\(.)/g, '$1');
      labelFiltersToAdd.push({ label: match[1], op: match[2], value: unescapedValue });
    } else {
      logger.warn(`[Metrics Drilldown] Could not parse label part: "${part}" for labels: ${labelsContent}`);
    }
  });

  return labelFiltersToAdd;
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
