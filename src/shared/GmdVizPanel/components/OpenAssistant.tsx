import { css, cx } from '@emotion/css';
import { createAssistantContextItem, isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObjectBase,
  VizPanel,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React, { useEffect, useState } from 'react';

import { getTrailFor } from 'shared/utils/utils';
import { removeIgnoreUsageLabel } from 'shared/utils/utils.queries';

import { getPanelData } from './addToDashboard/addToDashboard';

interface OpenAssistantState extends SceneObjectState {}

export class OpenAssistant extends SceneObjectBase<OpenAssistantState> {
  constructor() {
    super({});
  }

  public static readonly Component = ({ model }: SceneComponentProps<OpenAssistant>) => {
    const styles = useStyles2(getStyles);
    const [isAvailable, setIsAvailable] = useState(false);
    const explainInAssistantLabel = t('open-assistant.explain-label', 'Explain in Assistant');

    const vizPanel = sceneGraph.findObject(model, (o) => o instanceof VizPanel) as VizPanel | undefined;

    useEffect(() => {
      const subscription = isAssistantAvailable().subscribe((available) => {
        setIsAvailable(available);
      });
      return () => subscription.unsubscribe();
    }, []);

    if (!isAvailable || !vizPanel) {
      return null;
    }

    const handleClick = async () => {
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
        const trail = getTrailFor(model);
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
    };

    return (
      <Button
        id="open-assistant-action"
        className={cx(styles.button)}
        aria-label={explainInAssistantLabel}
        variant="secondary"
        size="sm"
        fill="text"
        onClick={handleClick}
        icon="ai-sparkle"
        tooltip={explainInAssistantLabel}
        tooltipPlacement="top"
        data-testid="open-assistant-action"
      />
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  button: css`
    margin: 0;
    padding: 0;
    margin-left: ${theme.spacing(1)};
  `,
});
