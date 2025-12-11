import { css, cx } from '@emotion/css';
import { createAssistantContextItem, isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { sceneGraph, SceneObjectBase, VizPanel, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React, { useEffect, useState } from 'react';

import { getPanelData } from './addToDashboard/addToDashboard';

const OPEN_ASSISTANT_LABEL = 'Open in Assistant';

interface OpenAssistantState extends SceneObjectState {}

export class OpenAssistant extends SceneObjectBase<OpenAssistantState> {
  constructor() {
    super({});
  }

  public static readonly Component = ({ model }: SceneComponentProps<OpenAssistant>) => {
    const styles = useStyles2(getStyles);
    const [isAvailable, setIsAvailable] = useState(false);

    // Find the VizPanel in the scene graph
    const vizPanel = sceneGraph.findObject(model, (o) => o instanceof VizPanel) as VizPanel | undefined;

    useEffect(() => {
      const subscription = isAssistantAvailable().subscribe((available) => {
        setIsAvailable(available);
      });

      return () => subscription.unsubscribe();
    }, []);

    // Don't render if assistant is not available or no vizPanel
    if (!isAvailable || !vizPanel) {
      return null;
    }

    const handleClick = () => {
      // Get fresh panel data at click time to ensure we capture the current state
      const panelData = getPanelData(vizPanel);
      const { panel } = panelData;

      // Extract the query expression from targets
      const query = panel.targets?.[0]?.expr || '';

      // Create datasource context
      const datasourceContext = createAssistantContextItem('datasource', {
        datasourceUid: panel.datasource?.uid || '',
      });

      // Create structured context with metric and query info
      const metricContext = createAssistantContextItem('structured', {
        title: 'Metrics Drilldown Query',
        data: {
          metricName: panel.title || '',
          query: query,
        },
      });

      openAssistant({
        origin: 'grafana-metricsdrilldown-app/metric-panel',
        prompt: 'Help me understand this metric and provide a summary of the data. Be concise and to the point.',
        context: [datasourceContext, metricContext],
      });
    };

    return (
      <Button
        id="open-assistant-action"
        className={cx(styles.button)}
        aria-label={OPEN_ASSISTANT_LABEL}
        variant="secondary"
        size="sm"
        fill="text"
        onClick={handleClick}
        icon="ai-sparkle"
        tooltip={OPEN_ASSISTANT_LABEL}
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
