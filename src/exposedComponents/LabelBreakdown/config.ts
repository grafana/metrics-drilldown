import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import pluginJson from '../../plugin.json';
import { type LabelBreakdownProps } from './LabelBreakdown';
import { LazyLabelBreakdown } from './LazyLabelBreakdown';

export const labelBreakdownConfig = {
  id: `${pluginJson.id}/label-breakdown-component/v1`,
  title: 'Label Breakdown',
  description: 'A metrics label breakdown view from the Metrics Drilldown app.',
  component: LazyLabelBreakdown,
} as const satisfies PluginExtensionExposedComponentConfig<LabelBreakdownProps>;
