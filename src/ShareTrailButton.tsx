import { config } from '@grafana/runtime';
import { ToolbarButton } from '@grafana/ui';
import React, { useState } from 'react';

import { PLUGIN_BASE_URL } from './constants';
import { UI_TEXT } from './constants/ui';
import { type DataTrail } from './DataTrail';
import { reportExploreMetrics } from './interactions';
import { getUrlForTrail } from './utils';

interface ShareTrailButtonState {
  trail: DataTrail;
}

const COPY_LABEL = UI_TEXT.METRIC_SELECT_SCENE.COPY_URL_LABEL;

export const ShareTrailButton = ({ trail }: ShareTrailButtonState) => {
  const [tooltip, setTooltip] = useState(COPY_LABEL);

  const onShare = () => {
    if (navigator.clipboard) {
      reportExploreMetrics('selected_metric_action_clicked', { action: 'share_url' });
      const appUrl = config.appUrl.endsWith('/') ? config.appUrl.slice(0, -1) : config.appUrl;
      const url = `${appUrl}${PLUGIN_BASE_URL}/${getUrlForTrail(trail)}`;
      navigator.clipboard.writeText(url);
      setTooltip('Copied!');
      setTimeout(() => {
        setTooltip(COPY_LABEL);
      }, 2000);
    }
  };

  return <ToolbarButton variant={'canvas'} icon={'share-alt'} tooltip={tooltip} onClick={onShare} />;
};
