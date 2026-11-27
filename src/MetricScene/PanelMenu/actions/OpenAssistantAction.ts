import { createAssistantContextItem, openAssistant } from '@grafana/assistant';
import { type PanelMenuItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, VizPanel, type SceneObject } from '@grafana/scenes';

import { getPanelData } from '../../../shared/GmdVizPanel/components/addToDashboard/addToDashboard';
import { reportExploreMetrics } from '../../../shared/tracking/interactions';
import { getTrailFor } from '../../../shared/utils/utils';
import { removeIgnoreUsageLabel } from '../../../shared/utils/utils.queries';

export const EXPLAIN_METRIC_ORIGIN = 'grafana-metricsdrilldown-app/metric-panel';

type MetricMetadata = { type?: string; help?: string; unit?: string };

/** Pure builder for the "Explain in Assistant" prompt. Covered by the assistant evals (src/evals). */
export function buildExplainMetricPrompt(metricName: string, query: string): string {
  const queryPart = query ? ` The current metrics drilldown query is: \`${query}\`.` : '';
  return `Help me understand the metric "${metricName}" and explain what it measures.${queryPart}`;
}

/** Pure builder for the "Explain in Assistant" context items. Covered by the assistant evals (src/evals). */
export function buildExplainMetricContext(
  datasourceUid: string | undefined,
  metricName: string,
  metadata?: MetricMetadata | null
) {
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

  return context;
}

export class OpenAssistantAction {
  static create(panelMenuInstance: SceneObject): PanelMenuItem {
    return {
      text: t('open-assistant.explain-label', 'Explain in Assistant'),
      iconClassName: 'ai-sparkle',
      onClick: async () => {
        const vizPanel = sceneGraph.getAncestor(panelMenuInstance, VizPanel);
        const { panel } = getPanelData(vizPanel);

        const metricName = panel.title || 'unknown';
        const rawExpr = panel.targets?.[0]?.expr;
        const query = removeIgnoreUsageLabel(typeof rawExpr === 'string' ? rawExpr : '');
        const datasourceUid = panel.datasource?.uid;

        let metadata: MetricMetadata | null | undefined;
        try {
          const trail = getTrailFor(panelMenuInstance);
          metadata = await trail.getMetadataForMetric(metricName);
        } catch {
          // Metadata is optional context; proceed without it on failure.
        }

        reportExploreMetrics('explain_in_assistant_clicked', {
          has_query: Boolean(query),
          has_datasource: Boolean(datasourceUid),
          has_metadata: Boolean(metadata),
        });

        openAssistant({
          origin: EXPLAIN_METRIC_ORIGIN,
          prompt: buildExplainMetricPrompt(metricName, query),
          context: buildExplainMetricContext(datasourceUid, metricName, metadata),
        });
      },
    };
  }
}
