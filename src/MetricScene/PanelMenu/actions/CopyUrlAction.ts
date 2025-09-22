import { type PanelMenuItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import { type DataTrail } from 'AppDataTrail/DataTrail';

import { PLUGIN_BASE_URL } from '../../../constants';
import { reportExploreMetrics } from '../../../interactions';
import { displaySuccess } from '../../../MetricsReducer/helpers/displayStatus';
import { getUrlForTrail } from '../../../utils';

export class CopyUrlAction {
  static create(trail: DataTrail): PanelMenuItem {
    return {
      text: 'Copy URL',
      iconClassName: 'copy',
      onClick: () => {
        if (navigator.clipboard) {
          reportExploreMetrics('selected_metric_action_clicked', { action: 'share_url' });
          const appUrl = config.appUrl.endsWith('/') ? config.appUrl.slice(0, -1) : config.appUrl;
          const url = `${appUrl}${PLUGIN_BASE_URL}/${getUrlForTrail(trail)}`;
          navigator.clipboard.writeText(url);
          displaySuccess(['URL copied to clipboard']);
        }
      },
    };
  }
}
