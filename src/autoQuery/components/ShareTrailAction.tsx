import { config } from '@grafana/runtime';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import React, { useState } from 'react';

import { PLUGIN_BASE_URL } from '../../constants';
import { UI_TEXT } from '../../constants/ui';
import { reportExploreMetrics } from '../../interactions';
import { getTrailFor, getUrlForTrail } from '../../utils';

interface ShareTrailActionState extends SceneObjectState {}

export class ShareTrailAction extends SceneObjectBase<ShareTrailActionState> {
  constructor() {
    super({
      key: 'share-trail-action',
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<ShareTrailAction>) => {
    const trail = getTrailFor(model);
    const [tooltip, setTooltip] = useState(UI_TEXT.METRIC_SELECT_SCENE.COPY_URL_LABEL);

    const onShare = () => {
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
      <Button
        variant={'secondary'}
        fill={'outline'}
        size={'sm'}
        icon="share-alt"
        onClick={onShare}
        tooltip={tooltip}
      >
        Share
      </Button>
    );
  };
}
