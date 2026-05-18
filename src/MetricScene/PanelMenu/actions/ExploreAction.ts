import { type PanelMenuItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { getExploreURL, sceneGraph, VizPanel } from '@grafana/scenes';

import { removeIgnoreUsageLabel } from 'shared/utils/utils.queries';

type ExploreQueryTransform = NonNullable<Parameters<typeof getExploreURL>[3]>;
type ExploreQuery = Parameters<ExploreQueryTransform>[0];
type ExploreMetricsQuery = ExploreQuery & {
  expr?: unknown;
  fromExploreMetrics?: unknown;
  legendFormat?: unknown;
};

export const transformExploreQuery: ExploreQueryTransform = (query) => {
  const queryWithoutDrilldownLegend: ExploreMetricsQuery = { ...query };

  if (queryWithoutDrilldownLegend.fromExploreMetrics === true) {
    delete queryWithoutDrilldownLegend.legendFormat;
  }

  if ('expr' in queryWithoutDrilldownLegend && typeof queryWithoutDrilldownLegend.expr === 'string') {
    return {
      ...queryWithoutDrilldownLegend,
      expr: removeIgnoreUsageLabel(queryWithoutDrilldownLegend.expr),
    } as ExploreQuery;
  }

  return queryWithoutDrilldownLegend;
};

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
      exploreUrl = getExploreURL(panelData, panelMenuInstance, panelData.timeRange, transformExploreQuery);
    } catch {}

    return {
      text: t('panel-menu.action.explore', 'Explore'),
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
