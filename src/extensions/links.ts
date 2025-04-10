// CAUTION: Imports in this file will contribute to the module.tsx bundle size
import {
  PluginExtensionPoints,
  type PluginExtensionAddedLinkConfig,
  type PluginExtensionPanelContext,
} from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { PLUGIN_BASE_URL, ROUTES } from '../constants';

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

      const query = parsePromQueryRegex(queries[0].expr);

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

      const pathToMetricView = createAppUrl(ROUTES.Trail, params);

      return {
        path: pathToMetricView,
      };
    },
  },
];

export function createAppUrl(route: string, urlParams?: URLSearchParams): string {
  return `${PLUGIN_BASE_URL}/${route}${urlParams ? `?${urlParams.toString()}` : ''}`;
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
function parsePromQueryRegex(query: string): ParsedPromQuery {
  let metric: string | undefined = undefined;
  const labelFilters: PromLabelFilter[] = [];
  const trimmedQuery = query.trim();

  // Regex to find metric name optionally followed by labels
  // Tries to capture the first identifier and an optional subsequent label block {}
  const queryMatch = trimmedQuery.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s*(?:\{([^}]*)\})?/);

  if (queryMatch) {
    const potentialMetric = queryMatch[1];
    const labelsContent = queryMatch[2]; // Undefined if no {}

    // Avoid matching known function names like 'rate', 'sum' if they are followed by '('
    // indicating a function call rather than a metric identifier.
    const nextCharIndex = queryMatch[0].length;
    const nextChar = trimmedQuery[nextCharIndex];
    const isLikelyFunctionCall = nextChar === '(';

    // Set of known PromQL functions/keywords that are unlikely to be metrics when followed by '('
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
      // Aggregation clauses etc.
      'by',
      'without',
      'on',
      'ignoring',
      'group_left',
      'group_right',
    ]);

    if (!(isLikelyFunctionCall && knownKeywords.has(potentialMetric))) {
      metric = potentialMetric;
    }
    // If it is a likely function call, we don't assign the metric here.
    // More sophisticated parsing would be needed to find the metric *inside* the function.

    // Parse labels if content exists
    if (labelsContent !== undefined) {
      const labelParts = labelsContent.split(',');
      // Regex for a single label key-op-value pair
      const labelRegex = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([=!~]+)\s*"((?:[^"\\]|\\.)*)"\s*$/;
      // Note: The value regex `((?:[^"\\]|\\.)*)` handles escaped quotes (\") inside the value.
      labelParts.forEach((part) => {
        if (part.trim() === '') {
          return;
        } // Skip empty parts (e.g., from trailing commas)
        const match = part.match(labelRegex);
        if (match) {
          // Unescape values (e.g., \\ -> \, \" -> ")
          const unescapedValue = match[3].replace(/\\(.)/g, '$1');
          labelFilters.push({ label: match[1], op: match[2], value: unescapedValue });
        } else {
          console.warn(`[Metrics Drilldown] Could not parse label part: "${part}" in query: "${query}"`);
        }
      });
    }
  } else {
    // The initial regex didn't match (e.g., query doesn't start with an identifier).
    // This might happen with binary operations at the very start, or complex cases.
    console.warn(`[Metrics Drilldown] Could not extract metric/labels from start of query: "${query}"`);
  }

  // If no metric was found initially (e.g. function call), try a simpler scan
  // for the first identifier that isn't a known keyword. This is less reliable.
  if (!metric) {
    const identifiers = trimmedQuery.match(/[a-zA-Z_:][a-zA-Z0-9_:]*/g) || [];
    const knownKeywords = new Set(['rate', 'increase', 'sum', 'avg', /* ... add others ... */ 'by', 'without']);
    for (const id of identifiers) {
      if (!knownKeywords.has(id) && isNaN(Number(id))) {
        // Check if it's not a keyword and not a number
        metric = id;
        // Attempt to find associated labels *near* this identifier
        // This part is heuristic and less reliable. For now, we just take the metric.
        // A more robust solution would require actual parsing.
        break;
      }
    }
  }

  return { metric, labelFilters, query };
}
