// CAUTION: Imports in this file will contribute to the module.tsx bundle size
import {
  PluginExtensionPoints,
  type PluginExtensionAddedLinkConfig,
  type PluginExtensionPanelContext,
} from '@grafana/data';
import { type DataQuery } from '@grafana/schema';
import { parser } from '@prometheus-io/lezer-promql';

import { PLUGIN_BASE_URL, ROUTES } from '../constants';
import { logger } from '../tracking/logger/logger';

const PRODUCT_NAME = 'Grafana Metrics Drilldown';
const title = `Open in ${PRODUCT_NAME}`;
const description = `Open current query in the ${PRODUCT_NAME} view`;
const category = 'metrics-drilldown';
const icon = 'gf-prometheus';

export const linkConfigs: PluginExtensionAddedLinkConfig[] = [
  {
    title,
    description,
    category,
    icon,
    path: createAppUrl(ROUTES.Drilldown),
    targets: [PluginExtensionPoints.DashboardPanelMenu, PluginExtensionPoints.ExploreToolbarAction],
    configure: configureDrilldownLink,
  },
];

export function configureDrilldownLink(context: object | undefined) {
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

  try {
    const { metric, labels, hasErrors, errors } = parsePromQLQuery(expr);

    if (hasErrors) {
      logger.warn(`PromQL query has parsing errors: ${errors.join(', ')}`);
    }

    const timeRange =
      'timeRange' in context &&
      typeof context.timeRange === 'object' &&
      context.timeRange !== null &&
      'from' in context.timeRange &&
      'to' in context.timeRange
        ? (context.timeRange as { from: string; to: string })
        : undefined;

    const params = appendUrlParameters([
      [UrlParameters.Metric, metric], // we can create a path without a metric
      [UrlParameters.TimeRangeFrom, timeRange?.from],
      [UrlParameters.TimeRangeTo, timeRange?.to],
      [UrlParameters.DatasourceId, datasource.uid],
      ...labels.map(
        (filter) => [UrlParameters.Filters, `${filter.label}${filter.op}${filter.value}`] as [UrlParameterType, string]
      ),
    ]);

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
export interface ParsedPromQLQuery {
  metric: string;
  labels: Array<{ label: string; op: string; value: string }>;
  hasErrors: boolean;
  errors: string[];
}

export function parsePromQLQuery(expr: string): ParsedPromQLQuery {
  const tree = parser.parse(expr);
  let metric = '';
  const labels: Array<{ label: string; op: string; value: string }> = [];
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

// Helper function to process label matcher nodes
function processLabelMatcher(node: any, expr: string): { label: string; op: string; value: string } | null {
  if (node.name !== 'UnquotedLabelMatcher') {
    return null;
  }

  const labelNode = node.node;
  let labelName = '';
  let op = '';
  let value = '';
  
  // Get children of UnquotedLabelMatcher
  for (let child = labelNode.firstChild; child; child = child.nextSibling) {
    if (child.type.name === 'LabelName') {
      labelName = expr.slice(child.from, child.to);
    } else if (child.type.name === 'MatchOp') {
      op = expr.slice(child.from, child.to);
    } else if (child.type.name === 'StringLiteral') {
      value = expr.slice(child.from + 1, child.to - 1); // Remove quotes
    }
  }
  
  if (labelName && op) { // Allow empty string values
    return { label: labelName, op, value };
  }
  return null;
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
