import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import { LazyMiniBreakdown } from './LazyMiniBreakdown';
import { type MiniBreakdownProps } from './MiniBreakdown';
import pluginJson from '../../plugin.json';

export const miniBreakdownConfig = {
  id: `${pluginJson.id}/mini-breakdown-component/v1`,
  title: 'Mini Label Breakdown Navigation',
  description: 'A mini metrics label breakdown view from the Metrics Drilldown app used for navigation.',
  component: LazyMiniBreakdown,
} as const satisfies PluginExtensionExposedComponentConfig<MiniBreakdownProps>;
