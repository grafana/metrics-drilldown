import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import { labelBreakdownConfig } from './LabelBreakdown/config';
import { embeddedMetricsReducerConfig } from './MetricsReducer/config';

type ExposedComponentConfigs = Array<PluginExtensionExposedComponentConfig<any>>;

// When creating a new exposed component, add its config to this array
export const exposedComponentConfigs = [
  labelBreakdownConfig,
  embeddedMetricsReducerConfig,
] satisfies ExposedComponentConfigs;

export type ExposedComponentName = (typeof exposedComponentConfigs)[number]['title'];
