import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import { LazyMetricHandoff } from './LazyMetricHandoff';
import { type MetricHandoffProps } from './types';
import pluginJson from '../../plugin.json';

export const metricHandoffConfig = {
  id: `${pluginJson.id}/metric-handoff/v1`,
  title: 'Metric Handoff',
  description: 'Scoped links to Explore and Metrics Drilldown without owning host navigation or state.',
  component: LazyMetricHandoff,
} as const satisfies PluginExtensionExposedComponentConfig<MetricHandoffProps>;
