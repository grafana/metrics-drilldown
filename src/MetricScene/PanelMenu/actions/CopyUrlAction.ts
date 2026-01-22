import { type PanelMenuItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import { type DataTrail } from 'AppDataTrail/DataTrail';
import { PLUGIN_BASE_URL } from 'shared/constants/plugin';

import { displaySuccess } from '../../../MetricsReducer/helpers/displayStatus';
import { reportExploreMetrics } from '../../../shared/tracking/interactions';
import { getUrlForTrail } from '../../../shared/utils/utils';

export class CopyUrlAction {
  static create(trail: DataTrail): PanelMenuItem {
    return {
      text: t('panel-menu.action.copy-url', 'Copy URL'),
      iconClassName: 'copy',
      onClick: () => {
        if (navigator.clipboard) {
          reportExploreMetrics('selected_metric_action_clicked', { action: 'share_url' });
          const appUrl = config.appUrl.endsWith('/') ? config.appUrl.slice(0, -1) : config.appUrl;
          const url = `${appUrl}${PLUGIN_BASE_URL}/${getUrlForTrail(trail)}`;
          navigator.clipboard.writeText(url);
          displaySuccess([t('panel-menu.action.copy-url-success', 'URL copied to clipboard')]);
        }
      },
    };
  }
}
