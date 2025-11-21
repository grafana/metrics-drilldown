import { type PanelMenuItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getExploreURL, sceneGraph, VizPanel } from '@grafana/scenes';

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
        // remove __ignore_usage__="" from the query
        if ('expr' in query && typeof query.expr === 'string' && query.expr.includes('__ignore_usage__')) {
          return {
            ...query,
            expr: query.expr.replace(/,?__ignore_usage__="",?/, ''), // also remove leading/trailing comma if present
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
