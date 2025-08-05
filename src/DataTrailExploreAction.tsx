import { getExploreURL, sceneGraph } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';
import React from 'react';

import { logger } from 'tracking/logger/logger';

import { AutoVizPanel } from './autoQuery/components/AutoVizPanel';
import { UI_TEXT } from './constants/ui';
import { type DataTrail } from './DataTrail';
import { reportExploreMetrics } from './interactions';
import { METRIC_AUTOVIZPANEL_KEY } from './MetricGraphScene';
import { type MetricScene } from './MetricScene';

interface DataTrailExploreActionProps {
  trail: DataTrail;
}

export const DataTrailExploreAction = ({ trail }: DataTrailExploreActionProps) => {
  const handleClick = async () => {
    try {
      reportExploreMetrics('selected_metric_action_clicked', { action: 'open_in_explore' });
      
      // Find the metric scene within the trail
      const metricScene = trail.state.topScene as MetricScene;
      if (!metricScene) {
        // console.error('No metric scene found in trail');
        return;
      }

      const autoVizPanel = sceneGraph.findByKeyAndType(metricScene, METRIC_AUTOVIZPANEL_KEY, AutoVizPanel);
      const panelData =
        typeof autoVizPanel.state.panel !== 'undefined'
          ? sceneGraph.getData(autoVizPanel.state.panel).state.data
          : undefined;

      if (!panelData) {
        // console.error('Cannot get link to explore, no panel data found');
        return;
      }

      const link = await getExploreURL(panelData, metricScene, panelData.timeRange);
      window.open(link, '_blank');
    } catch (error) {
      logger.error(error as Error);
    }
  };

  return (
    <ToolbarButton
      icon="compass"
      tooltip={UI_TEXT.METRIC_SELECT_SCENE.OPEN_EXPLORE_LABEL}
      onClick={handleClick}
      variant="canvas"
    />
  );
};
