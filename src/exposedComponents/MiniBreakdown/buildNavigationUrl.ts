import { locationService } from '@grafana/runtime';

import {
  buildNavigateToMetricsParams,
  createAppUrl,
  createPromURLObject,
} from '../../extensions/links';
import { ROUTES } from '../../shared/constants/routes';

interface BuildMiniBreakdownUrlParams {
  metric: string;
  labels: Array<{ label: string; op: string; value: string }>; // What parsePromQLQuery returns
  dataSource: string;
  from: string;
  to: string;
  groupBy?: string;
}

/**
 * Build navigation URL for embeddedMini click navigation.
 *
 * - Without groupBy: navigates to metric breakdown (main panel click)
 * - With groupBy: navigates to metric breakdown with var-groupby AND actionView=breakdown (label panel click)
 */
export function buildMiniBreakdownNavigationUrl({
  metric,
  labels,
  dataSource,
  from,
  to,
  groupBy,
}: BuildMiniBreakdownUrlParams): string {
  const promURLObject = createPromURLObject(dataSource, labels, metric, from, to);
  const params = buildNavigateToMetricsParams(promURLObject);
  // default to breakdown and set the groupby if provided
  params.append('actionView', 'breakdown');
  params.append('var-groupby', groupBy ?? '$__all');

  return createAppUrl(ROUTES.Drilldown, params);
}

/**
 * Navigate to the built URL
 */
export function navigateToMiniBreakdownUrl(params: BuildMiniBreakdownUrlParams): void {
  const url = buildMiniBreakdownNavigationUrl(params);
  locationService.push(url);
}

