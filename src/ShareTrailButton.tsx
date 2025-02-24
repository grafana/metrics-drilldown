import { config } from '@grafana/runtime';
import { ToolbarButton } from '@grafana/ui';
import React, { useState } from 'react';

import { PLUGIN_BASE_URL } from './constants';
import { type DataTrail } from './DataTrail';
import { reportExploreMetrics } from './interactions';
import { getUrlForTrail } from './utils';

interface ShareTrailButtonState {
  trail: DataTrail;
}

export const ShareTrailButton = ({ trail }: ShareTrailButtonState) => {
  const [tooltip, setTooltip] = useState('Copy url');

  const onShare = () => {
    if (navigator.clipboard) {
      reportExploreMetrics('selected_metric_action_clicked', { action: 'share_url' });
      const appUrl = config.appUrl.endsWith('/') ? config.appUrl.slice(0, -1) : config.appUrl;
      const url = `${appUrl}${PLUGIN_BASE_URL}/${getUrlForTrail(trail)}`;
      navigator.clipboard.writeText(url);
      setTooltip('Copied!');
      setTimeout(() => {
        setTooltip('Copy url');
      }, 2000);
    }
  };

  return <ToolbarButton variant={'canvas'} icon={'share-alt'} tooltip={tooltip} onClick={onShare} />;
};
