import { type PanelMenuItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import { PLUGIN_BASE_URL } from '../../constants';
import { type DataTrail } from '../../DataTrail';
import { reportExploreMetrics } from '../../interactions';
import { getUrlForTrail } from '../../utils';
import { displaySuccess } from '../../WingmanDataTrail/helpers/displayStatus';

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
