import { type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';

export const OTHER_CATEGORY_ID = 'other';

// The trace view draws the Service category with a custom hexagon, which is not part of the Grafana icon set
export const SERVICE_HEXAGON_ICON = 'service-hexagon';

interface MetricCategory {
  id: string;
  prefixes: string[];
}

/**
 * Metric categories, in display order.
 *
 * The ids and prefixes come from the attribute categories of the Grafana trace view
 * (public/app/features/explore/TraceView/components/TraceTimelineViewer/SpanDetail/attributeCategories.ts).
 * The trace view orders its span and resource attributes with separate lists. Here, the span list (http, url) comes
 * first, then the resource list, then the remaining categories sorted by label.
 */
export const METRIC_CATEGORIES: MetricCategory[] = [
  { id: 'http', prefixes: ['http'] },
  { id: 'url', prefixes: ['url'] },
  { id: 'frontend', prefixes: ['browser', 'device', 'session', 'gf.feo11y'] },
  { id: 'service', prefixes: ['service'] },
  { id: 'deployment', prefixes: ['deployment'] },
  { id: 'database', prefixes: ['db'] },
  { id: 'process', prefixes: ['process'] },
  { id: 'runtime', prefixes: ['jvm', 'nodejs', 'go', 'dotnet'] },
  { id: 'container', prefixes: ['container'] },
  { id: 'kubernetes', prefixes: ['k8s'] },
  { id: 'host-os', prefixes: ['host', 'system', 'os'] },
  { id: 'cloud', prefixes: ['cloud', 'aws', 'gcp', 'azure', 'google'] },
  { id: 'telemetry-sdk', prefixes: ['telemetry'] },
  { id: 'error', prefixes: ['error'] },
  { id: 'exception', prefixes: ['exception'] },
  { id: 'messaging', prefixes: ['messaging'] },
  { id: 'network', prefixes: ['network', 'net', 'server', 'client'] },
  { id: 'rpc', prefixes: ['rpc'] },
];

// "." and "_" are treated the same, so "go.memory.used" and "go_memory_used" match the same prefix
const normalize = (value: string) => value.toLowerCase().replace(/\./g, '_');

const NORMALIZED_PREFIXES = METRIC_CATEGORIES.map(({ id, prefixes }) => ({
  id,
  prefixes: prefixes.map((prefix) => `${normalize(prefix)}_`),
}));

/**
 * Returns the id of the first category with a prefix that the metric name starts with (followed by "_" or "."),
 * or "other" when none matches.
 */
export function classifyMetric(metricName: string): string {
  const name = normalize(metricName);

  for (const { id, prefixes } of NORMALIZED_PREFIXES) {
    if (prefixes.some((prefix) => name.startsWith(prefix))) {
      return id;
    }
  }

  return OTHER_CATEGORY_ID;
}

// The i18n extractor needs literal `t()` calls, and they cannot run at module scope, so the labels live in a function
export function getMetricCategoryLabel(id: string): string {
  switch (id) {
    case 'http':
      return t('sidebar.metric-category.http', 'HTTP');
    case 'url':
      return t('sidebar.metric-category.url', 'URL');
    case 'frontend':
      return t('sidebar.metric-category.frontend', 'Frontend');
    case 'service':
      return t('sidebar.metric-category.service', 'Service');
    case 'deployment':
      return t('sidebar.metric-category.deployment', 'Deployment');
    case 'database':
      return t('sidebar.metric-category.database', 'Database');
    case 'process':
      return t('sidebar.metric-category.process', 'Process');
    case 'runtime':
      return t('sidebar.metric-category.runtime', 'Runtime-specific');
    case 'container':
      return t('sidebar.metric-category.container', 'Container');
    case 'kubernetes':
      return t('sidebar.metric-category.kubernetes', 'Kubernetes');
    case 'host-os':
      return t('sidebar.metric-category.host-os', 'Host / OS');
    case 'cloud':
      return t('sidebar.metric-category.cloud', 'Cloud');
    case 'telemetry-sdk':
      return t('sidebar.metric-category.telemetry-sdk', 'Telemetry SDK');
    case 'error':
      return t('sidebar.metric-category.error', 'Error');
    case 'exception':
      return t('sidebar.metric-category.exception', 'Exception');
    case 'messaging':
      return t('sidebar.metric-category.messaging', 'Messaging');
    case 'network':
      return t('sidebar.metric-category.network', 'Network');
    case 'rpc':
      return t('sidebar.metric-category.rpc', 'RPC');
    case OTHER_CATEGORY_ID:
      return t('sidebar.metric-category.other', 'Other');
    default:
      return id;
  }
}

/**
 * Icon of each category, the same as the one the Grafana trace view shows for the category
 * (public/app/features/explore/TraceView/components/TraceTimelineViewer/SpanDetail/attributeCategories.ts).
 * The trace view groups HTTP, URL and Network under one icon, and so does this table.
 */
const METRIC_CATEGORY_ICONS: Record<string, IconName | typeof SERVICE_HEXAGON_ICON> = {
  http: 'globe',
  url: 'globe',
  frontend: 'frontend-observability',
  service: SERVICE_HEXAGON_ICON,
  deployment: 'rocket',
  database: 'database',
  process: 'process',
  runtime: 'code-branch',
  container: 'cube',
  kubernetes: 'kubernetes',
  'host-os': 'layer-group',
  cloud: 'cloud-provider',
  'telemetry-sdk': 'brackets-curly',
  error: 'exclamation-circle',
  exception: 'exclamation-triangle',
  messaging: 'envelope',
  network: 'globe',
  rpc: 'exchange-alt',
  [OTHER_CATEGORY_ID]: 'tag-alt',
};

export function getMetricCategoryIcon(id: string): IconName | typeof SERVICE_HEXAGON_ICON {
  return METRIC_CATEGORY_ICONS[id] ?? 'tag-alt';
}
