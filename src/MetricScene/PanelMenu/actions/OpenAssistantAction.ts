import { createAssistantContextItem, openAssistant } from '@grafana/assistant';
import { type PanelMenuItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, VizPanel, type SceneObject } from '@grafana/scenes';

import { getPanelData } from '../../../shared/GmdVizPanel/components/addToDashboard/addToDashboard';
import { getTrailFor } from '../../../shared/utils/utils';
import { removeIgnoreUsageLabel } from '../../../shared/utils/utils.queries';

export class OpenAssistantAction {
  static create(panelMenuInstance: SceneObject): PanelMenuItem {
    return {
      text: t('open-assistant.explain-label', 'Explain in Assistant'),
      iconClassName: 'ai-sparkle',
      onClick: async () => {
        const vizPanel = sceneGraph.getAncestor(panelMenuInstance, VizPanel);
        const { panel } = getPanelData(vizPanel);

        // Get metric name from panel title
        const metricName = panel.title || 'unknown';

        // Extract the query expression and remove __ignore_usage__ label
        const rawExpr = panel.targets?.[0]?.expr;
        const query = removeIgnoreUsageLabel(typeof rawExpr === 'string' ? rawExpr : '');

        // Build prompt with or without query
        const queryPart = query ? ` The current metrics drilldown query is: \`${query}\`.` : '';

        // Build context with datasource and metric info when available
        const datasourceUid = panel.datasource?.uid;
        const context = datasourceUid
          ? [
              createAssistantContextItem('datasource', { datasourceUid }),
              createAssistantContextItem('label_value', {
                datasourceUid,
                labelName: '__name__',
                labelValue: metricName,
              }),
            ]
          : [];

        // Try to get metric metadata and add it as context
        try {
          const trail = getTrailFor(panelMenuInstance);
          const metadata = await trail.getMetadataForMetric(metricName);
          if (metadata) {
            context.push(
              createAssistantContextItem('structured', {
                title: t('open-assistant.metric-metadata-title', 'Prometheus metric metadata'),
                data: {
                  type: metadata.type,
                  description: metadata.help,
                  unit: metadata.unit,
                },
              })
            );
          }
        } catch {
          // Metadata fetch failed, continue without it
        }

        openAssistant({
          origin: 'grafana-metricsdrilldown-app/metric-panel',
          prompt: `Help me understand the metric "${metricName}" and explain what it measures.${queryPart}`,
          context,
        });
      },
    };
  }
}
