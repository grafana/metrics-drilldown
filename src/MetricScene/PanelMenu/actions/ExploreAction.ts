import { type PanelMenuItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getExploreURL, sceneGraph, VizPanel } from '@grafana/scenes';

import { removeIgnoreUsageLabel } from 'shared/utils/utils.queries';

export class ExploreAction {
  static create(panelMenuInstance: any): PanelMenuItem {
    let exploreUrl: Promise<string | undefined> | undefined;

    try {
      const viz = sceneGraph.getAncestor(panelMenuInstance, VizPanel);
      const panelData = sceneGraph.getData(viz).state.data;
      if (!panelData) {
        throw new Error('Cannot get link to explore, no panel data found');
      }
      // 'panelMenuInstance' scene object contain the variable for the metric name which is correctly interpolated into the explore url
      // when used in the metric select scene case,
      // this will get the explore url with interpolated variables and include the labels __ignore_usage__, this is a known issue
      // in the metric scene we do not get use the __ignore_usage__ labels in the explore url
      exploreUrl = getExploreURL(panelData, panelMenuInstance, panelData.timeRange, (query) => {
        if ('expr' in query && typeof query.expr === 'string') {
          return {
            ...query,
            expr: removeIgnoreUsageLabel(query.expr),
          };
        }

        return query;
      });
    } catch {}

    return {
      text: 'Explore',
      iconClassName: 'compass',
      onClick: () =>
        exploreUrl?.then((url) => {
          if (url) {
            window.open(`${config.appSubUrl}${url}`, '_blank');
          }
        }),
      shortcut: 'p x',
    };
  }
}
