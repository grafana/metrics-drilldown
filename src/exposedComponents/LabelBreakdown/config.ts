import { type PluginExtensionExposedComponentConfig } from '@grafana/data';

import { type LabelBreakdownProps } from './LabelBreakdown';
import { LazyLabelBreakdown } from './LazyLabelBreakdown';
import pluginJson from '../../plugin.json';

export const labelBreakdownConfig: PluginExtensionExposedComponentConfig<LabelBreakdownProps> = {
  id: `${pluginJson.id}/label-breakdown-component/v1`,
  title: 'Label Breakdown',
  description: 'A metrics label breakdown view from the Metrics Drilldown app.',
  component: LazyLabelBreakdown,
};
