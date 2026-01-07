import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import { labelBreakdownConfig } from './LabelBreakdown/config';

type ExposedComponentConfigs = Array<PluginExtensionExposedComponentConfig<any>>;

// When creating a new exposed component, add its config to this array
export const exposedComponentConfigs = [labelBreakdownConfig] satisfies ExposedComponentConfigs;

export type ExposedComponentName = (typeof exposedComponentConfigs)[number]['title'];
