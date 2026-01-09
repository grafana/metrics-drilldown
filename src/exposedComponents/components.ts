import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import { labelBreakdownConfig } from './LabelBreakdown/config';
import { miniBreakdownConfig } from './MiniBreakdown/config';
import { sourceMetricsConfig } from './SourceMetrics/config';

type ExposedComponentConfigs = Array<PluginExtensionExposedComponentConfig<any>>;

// When creating a new exposed component, add its config to this array
export const exposedComponentConfigs: ExposedComponentConfigs = [labelBreakdownConfig, miniBreakdownConfig, sourceMetricsConfig];

export type ExposedComponentName = (typeof exposedComponentConfigs)[number]['title'];
