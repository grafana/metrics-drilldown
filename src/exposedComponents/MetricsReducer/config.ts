import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import { type EmbeddedMetricsReducerProps } from './EmbeddedMetricsReducer';
import { LazyEmbeddedMetricsReducer } from './LazyEmbeddedMetricsReducer';
import pluginJson from '../../plugin.json';

export const embeddedMetricsReducerConfig = {
  id: `${pluginJson.id}/embedded-metrics-reducer/v1`,
  title: 'Embedded Metrics Reducer',
  description: 'A metrics reducer view from the Metrics Drilldown app.',
  component: LazyEmbeddedMetricsReducer,
} as const satisfies PluginExtensionExposedComponentConfig<EmbeddedMetricsReducerProps>;
