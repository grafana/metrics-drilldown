import { config } from '@grafana/runtime';
import { ToolbarButton } from '@grafana/ui';
import React, { useState } from 'react';

import { PLUGIN_BASE_URL } from './constants';
import { UI_TEXT } from './constants/ui';
import { type DataTrail } from './DataTrail';
import { reportExploreMetrics } from './interactions';
import { getUrlForTrail } from './utils';

interface DataTrailShareActionProps {
  trail: DataTrail;
}

export const DataTrailShareAction = ({ trail }: DataTrailShareActionProps) => {
  const [tooltip, setTooltip] = useState(UI_TEXT.METRIC_SELECT_SCENE.COPY_URL_LABEL);

  const handleClick = () => {
    if (navigator.clipboard) {
      reportExploreMetrics('selected_metric_action_clicked', { action: 'share_url' });
      const appUrl = config.appUrl.endsWith('/') ? config.appUrl.slice(0, -1) : config.appUrl;
      const url = `${appUrl}${PLUGIN_BASE_URL}/${getUrlForTrail(trail)}`;
      navigator.clipboard.writeText(url);
      setTooltip('Copied!');
      setTimeout(() => {
        setTooltip(UI_TEXT.METRIC_SELECT_SCENE.COPY_URL_LABEL);
      }, 2000);
    }
  };

  return (
    <ToolbarButton
      variant="canvas"
      icon="share-alt"
      tooltip={tooltip}
      onClick={handleClick}
    />
  );
};
