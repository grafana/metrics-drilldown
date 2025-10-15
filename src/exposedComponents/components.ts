import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import { entityMetricsConfig } from './EntityMetrics/config';
import { labelBreakdownConfig } from './LabelBreakdown/config';

type ExposedComponentConfigs = Array<PluginExtensionExposedComponentConfig<any>>;

// When creating a new exposed component, add its config to this array
export const exposedComponentConfigs = [labelBreakdownConfig, entityMetricsConfig] satisfies ExposedComponentConfigs;

export type ExposedComponentName = (typeof exposedComponentConfigs)[number]['title'];
