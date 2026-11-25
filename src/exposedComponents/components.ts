import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import { entityMetricsConfig } from './EntityMetrics/config';
import { labelBreakdownConfig } from './LabelBreakdown/config';
import { metricChartConfig } from './MetricChart/config';
import { metricHandoffConfig } from './MetricHandoff/config';
import { metricValueBreakdownConfig } from './MetricValueBreakdown/config';
import { miniBreakdownConfig } from './MiniBreakdown/config';
import { sourceMetricsConfig } from './SourceMetrics/config';

type ExposedComponentConfigs = Array<PluginExtensionExposedComponentConfig<any>>;

// When creating a new exposed component, add its config to this array
export const exposedComponentConfigs = [
  entityMetricsConfig,
  labelBreakdownConfig,
  miniBreakdownConfig,
  sourceMetricsConfig,
  metricChartConfig,
  metricValueBreakdownConfig,
  metricHandoffConfig,
] satisfies ExposedComponentConfigs;

export type ExposedComponentName = (typeof exposedComponentConfigs)[number]['title'];
