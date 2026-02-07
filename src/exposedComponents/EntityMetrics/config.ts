import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import { type EntityMetricsProps } from './EntityMetrics';
import { LazyEntityMetrics } from './LazyEntityMetrics';
import pluginJson from '../../plugin.json';

export const entityMetricsConfig = {
  id: `${pluginJson.id}/entity-metrics-component/v1`,
  title: 'Entity Metrics',
  description: 'A metrics exploration view for entity labels from the Metrics Drilldown app.',
  component: LazyEntityMetrics,
} as const satisfies PluginExtensionExposedComponentConfig<EntityMetricsProps>;
