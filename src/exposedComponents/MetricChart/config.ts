import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import { LazyMetricChart } from './LazyMetricChart';
import { type MetricChartProps } from './MetricChart';
import pluginJson from '../../plugin.json';

export const metricChartConfig = {
  id: `${pluginJson.id}/metric-chart/v1`,
  title: 'Metric Chart',
  description: 'A scoped, type-aware metric chart from Metrics Drilldown.',
  component: LazyMetricChart,
} as const satisfies PluginExtensionExposedComponentConfig<MetricChartProps>;
