import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import { labelBreakdownConfig } from './LabelBreakdown/config';
import { entityMetricsConfig } from './EntityMetrics/config';

type ExposedComponentConfigs = Array<PluginExtensionExposedComponentConfig<any>>;

// When creating a new exposed component, add its config to this array
export const exposedComponentConfigs = [labelBreakdownConfig, entityMetricsConfig] satisfies ExposedComponentConfigs;

export type ExposedComponentName = (typeof exposedComponentConfigs)[number]['title'];
