import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import { LazyMetricValueBreakdown } from './LazyMetricValueBreakdown';
import { type MetricValueBreakdownProps } from './MetricValueBreakdown';
import pluginJson from '../../plugin.json';

export const metricValueBreakdownConfig = {
  id: `${pluginJson.id}/metric-value-breakdown/v1`,
  title: 'Metric Value Breakdown',
  description: 'A scoped, chosen-label breakdown of the default grouped metric computation.',
  component: LazyMetricValueBreakdown,
} as const satisfies PluginExtensionExposedComponentConfig<MetricValueBreakdownProps>;
