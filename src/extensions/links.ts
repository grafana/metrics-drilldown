// CAUTION: Imports in this file will contribute to the module.tsx bundle size
import {
  PluginExtensionPoints,
  type CustomVariableModel,
  type PluginExtensionAddedLinkConfig,
  type PluginExtensionPanelContext,
  type QueryVariableModel,
} from '@grafana/data';
import { config, getTemplateSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { parser } from '@prometheus-io/lezer-promql';

import { parseMatcher } from './parseMatcher';
import { PLUGIN_BASE_URL, ROUTES } from '../constants';
import { logger } from '../tracking/logger/logger';
import { processLabelMatcher, type ParsedPromQLQuery, type PromQLLabelMatcher } from '../utils/utils.promql';

const PRODUCT_NAME = 'Grafana Metrics Drilldown';
const title = `Open in ${PRODUCT_NAME}`;
const description = `Open current query in the ${PRODUCT_NAME} view`;
const category = 'metrics-drilldown';
const icon = 'gf-prometheus';

const ASSISTANT_TARGET_V0 = 'grafana-metricsdrilldown-app/grafana-assistant-app/navigateToDrilldown/v0-alpha';
const ASSISTANT_TARGET_V1 = 'grafana-assistant-app/navigateToDrilldown/v1';

const ADHOC_URL_DELIMITER = '|';

export const linkConfigs: Array<PluginExtensionAddedLinkConfig<PluginExtensionPanelContext>> = [
  {
    title,
    description,
    category,
    icon,
    path: createAppUrl(ROUTES.Drilldown),
    targets: [
      PluginExtensionPoints.DashboardPanelMenu,
      PluginExtensionPoints.ExploreToolbarAction,
      // for testing purposes, this will be the target for the alerting rule query editor once the PR in grafana is merged
      // PluginExtensionPoints.AlertingRuleQueryEditor,
      'grafana/alerting/alertingrule/queryeditor',
      ASSISTANT_TARGET_V1,
    ],
    configure: configureDrilldownLink,
  },
  {
    targets: [ASSISTANT_TARGET_V0],
    title: 'Navigate to metrics drilldown',
    description: 'Build a url path to the metrics drilldown',
    path: createAppUrl(ROUTES.Drilldown),
    configure: (context) => {
      if (typeof context === 'undefined') {
        return;
      }

      const { navigateToMetrics, datasource_uid, label_filters, metric, start, end } =
        context as unknown as GrafanaAssistantMetricsDrilldownContext;
      // parse the labels to the PromQL format
      const parsedLabels = parseFiltersToLabelMatchers(label_filters);
      // create the PromURLObject for building params
      const promURLObject = createPromURLObject(datasource_uid, parsedLabels, metric, start, end);
      // build the params for the navigateToMetrics
      const params = navigateToMetrics ? buildNavigateToMetricsParams(promURLObject) : undefined;

      return {
        path: createAppUrl(ROUTES.Drilldown, params),
      };
    },
  },
];

export function configureDrilldownLink<T extends PluginExtensionPanelContext>(context?: T) {
  if (typeof context === 'undefined') {
    return;
  }

  if ('pluginId' in context && context.pluginId !== 'timeseries') {
    return;
  }

  const queries = context.targets.filter(isPromQuery);

  if (!queries.length) {
    return;
  }

  const prometheusQuery = queries[0] as PromQuery;

  const templateSrv = getTemplateSrv();
  const datasourceUid = templateSrv.replace(prometheusQuery?.datasource?.uid, context.scopedVars);

  // allow the user to navigate to the drilldown without a query (metrics reducer view)
  if (!prometheusQuery.expr) {
    return {
      path: createAppUrl(ROUTES.Drilldown),
    };
  }

  const expr = templateSrv.replace(prometheusQuery.expr, context.scopedVars, interpolateQueryExpr);

  try {
    const { metric, labels, hasErrors, errors } = parsePromQLQuery(expr);

    if (hasErrors) {
      logger.warn(`PromQL query has parsing errors: ${errors.join(', ')}`);
    }

    const timeRange =
      'timeRange' in context &&
      typeof context.timeRange === 'object' &&
      context.timeRange != null &&
      'from' in context.timeRange &&
      'to' in context.timeRange
        ? (context.timeRange as { from: string; to: string })
        : undefined;

    const promURLObject = createPromURLObject(datasourceUid, labels, metric, timeRange?.from, timeRange?.to);

    const params = buildNavigateToMetricsParams(promURLObject);

    const pathToMetricView = createAppUrl(ROUTES.Drilldown, params);

    return {
      path: pathToMetricView,
    };
  } catch (error) {
    logger.error(new Error(`[Metrics Drilldown] Error parsing PromQL query: ${error}`));

    return {
      path: createAppUrl(ROUTES.Drilldown),
    };
  }
}

export function parsePromQLQuery(expr: string): ParsedPromQLQuery {
  const tree = parser.parse(expr);
  let metric = '';
  const labels: PromQLLabelMatcher[] = [];
  let hasErrors = false;
  const errors: string[] = [];

  // Use tree.iterate() - much simpler than manual cursor traversal
  tree.iterate({
    enter: (node) => {
      // Check if this is an error node
      if (node.type.isError || node.name === '⚠') {
        hasErrors = true;
        const errorText = expr.slice(node.from, node.to);
        const errorMsg = errorText
          ? `Parse error at position ${node.from}-${node.to}: "${errorText}"`
          : `Parse error at position ${node.from}`;
        errors.push(errorMsg);
      }

      // Get the first metric name from any VectorSelector > Identifier
      if (!metric && node.name === 'Identifier' && node.node.parent?.type.name === 'VectorSelector') {
        metric = expr.slice(node.from, node.to);
      }

      // Extract label matchers using helper function
      const labelData = processLabelMatcher(node, expr);
      if (labelData) {
        labels.push(labelData);
      }
    },
  });

  return { metric, labels, hasErrors, errors };
}

/**
 * Scenes adhoc variable filters requires a | delimiter
 * between the label, operator, and value (see AdHocFiltersVariableUrlSyncHandler.ts in Scenes)
 */
function filterToUrlParameter(filter: PromQLLabelMatcher): [UrlParameterType, string] {
  return [
    UrlParameters.Filters,
    `${filter.label}${ADHOC_URL_DELIMITER}${filter.op}${ADHOC_URL_DELIMITER}${filter.value}`,
  ] as [UrlParameterType, string];
}

// Type for the metrics drilldown context from Grafana Assistant
export type GrafanaAssistantMetricsDrilldownContext = {
  navigateToMetrics: boolean;
  datasource_uid: string;
  label_filters?: string[];
  metric?: string;
  start?: string;
  end?: string;
};

type PromURLObject = {
  datasource_uid?: string;
  label_filters?: PromQLLabelMatcher[];
  metric?: string;
  start?: string;
  end?: string;
};

export function createPromURLObject(
  datasource_uid?: string,
  label_filters?: PromQLLabelMatcher[],
  metric?: string,
  start?: string,
  end?: string
): PromURLObject {
  return {
    datasource_uid,
    label_filters: label_filters ?? [],
    metric,
    start,
    end,
  };
}

export function buildNavigateToMetricsParams(promURLObject: PromURLObject): URLSearchParams {
  const { metric, start, end, datasource_uid, label_filters } = promURLObject;

  const filters = label_filters ?? [];

  // Use the structured context data to build parameters
  return appendUrlParameters([
    [UrlParameters.Metric, metric],
    [UrlParameters.TimeRangeFrom, start],
    [UrlParameters.TimeRangeTo, end],
    [UrlParameters.DatasourceId, datasource_uid],
    ...filters.map(filterToUrlParameter),
  ]);
}

export function parseFiltersToLabelMatchers(label_filters?: string[]): PromQLLabelMatcher[] {
  if (!label_filters) {
    return [];
  }

  return label_filters.map((filter) => {
    const matcher = parseMatcher(filter);
    return {
      label: matcher.key,
      op: matcher.operator,
      value: matcher.value,
    };
  });
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

type UrlParameterType = (typeof UrlParameters)[keyof typeof UrlParameters];

function appendUrlParameters(
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
  const { datasource } = query;
  return datasource?.type === 'prometheus';
}

// Copied from interpolateQueryExpr in prometheus datasource, as we can't return a promise in the link extension config we can't fetch the datasource from the datasource srv, so we're forced to duplicate this method
// eslint-disable-next-line sonarjs/function-return-type
function interpolateQueryExpr(
  value: string | string[] = [],
  variable: QueryVariableModel | CustomVariableModel
): string | string[] {
  // if no multi or include all do not regexEscape
  if (!variable.multi && !variable.includeAll) {
    return prometheusRegularEscape(value);
  }

  if (typeof value === 'string') {
    return prometheusSpecialRegexEscape(value);
  }

  const escapedValues = value.map((val) => prometheusSpecialRegexEscape(val));

  if (escapedValues.length === 1) {
    return escapedValues[0];
  }

  return '(' + escapedValues.join('|') + ')';
}

// not exported from @grafana/prometheus, so we're forced to duplicate it here
// eslint-disable-next-line sonarjs/function-return-type
function prometheusRegularEscape<T>(value: T) {
  if (typeof value !== 'string') {
    return value;
  }

  if (config.featureToggles.prometheusSpecialCharsInLabelValues) {
    // if the string looks like a complete label matcher (e.g. 'job="grafana"' or 'job=~"grafana"'),
    // don't escape the encapsulating quotes
    if (/^\w+(=|!=|=~|!~)".*"$/.test(value)) {
      return value;
    }

    return value
      .replace(/\\/g, '\\\\') // escape backslashes
      .replace(/"/g, '\\"'); // escape double quotes
  }

  // classic behavior
  return value
    .replace(/\\/g, '\\\\') // escape backslashes
    .replace(/'/g, "\\\\'"); // escape single quotes
}

// not exported from @grafana/prometheus, so we're forced to duplicate it here
// eslint-disable-next-line sonarjs/function-return-type
function prometheusSpecialRegexEscape<T>(value: T) {
  if (typeof value !== 'string') {
    return value;
  }

  if (config.featureToggles.prometheusSpecialCharsInLabelValues) {
    return value
      .replace(/\\/g, '\\\\\\\\') // escape backslashes
      .replace(/"/g, '\\\\\\"') // escape double quotes
      .replace(/[$^*{}\[\]\'+?.()|]/g, '\\\\$&'); // escape regex metacharacters
  }

  // classic behavior
  return value
    .replace(/\\/g, '\\\\\\\\') // escape backslashes
    .replace(/[$^*{}\[\]+?.()|]/g, '\\\\$&'); // escape regex metacharacters
}
