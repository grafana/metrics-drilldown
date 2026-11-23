import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import pluginJson from '../../plugin.json';
import { LazySourceMetrics } from './LazySourceMetrics';
import { type SourceMetricsProps } from './SourceMetrics';

export const sourceMetricsConfig = {
  id: `${pluginJson.id}/knowledge-graph-insight-metrics/v1`,
  title: 'Knowledge Graph Source Metrics',
  description: 'Explore the underlying metrics related to a Knowledge Graph insight',
  component: LazySourceMetrics,
} as const satisfies PluginExtensionExposedComponentConfig<SourceMetricsProps>;
