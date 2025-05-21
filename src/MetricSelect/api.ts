import { type AdHocVariableFilter, type RawTimeRange, type Scope } from '@grafana/data';
import { getPrometheusTime, PromQueryModeller, utf8Support } from '@grafana/prometheus';
import { config, getBackendSrv } from '@grafana/runtime';

import { callSuggestionsApi, type SuggestionsResponse } from '../utils';

const LIMIT_REACHED = 'results truncated due to limit';

const queryModeller = new PromQueryModeller();

export async function getMetricNames(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  scopes: Scope[],
  filters: AdHocVariableFilter[],
  limit?: number
): Promise<SuggestionsResponse & { limitReached: boolean }> {
  if (!config.featureToggles.enableScopesInMetricsExplore) {
    return await getMetricNamesWithoutScopes(dataSourceUid, timeRange, filters, limit);
  }

  return getMetricNamesWithScopes(dataSourceUid, timeRange, scopes, filters, limit);
}

export async function getMetricNamesWithoutScopes(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  adhocFilters: AdHocVariableFilter[],
  limit?: number
) {
  const matchTerms = config.featureToggles.prometheusSpecialCharsInLabelValues
    ? adhocFilters.map((filter) =>
        removeBrackets(queryModeller.renderLabels([{ label: filter.key, op: filter.operator, value: filter.value }]))
      )
    : adhocFilters.map((filter) => `${utf8Support(filter.key)}${filter.operator}"${filter.value}"`);

  const filters = `{${matchTerms.join(',')}}`;

  const url = `/api/datasources/uid/${dataSourceUid}/resources/api/v1/label/__name__/values`;
  const params: Record<string, string | number> = {
    start: getPrometheusTime(timeRange.from, false),
    end: getPrometheusTime(timeRange.to, true),
    ...(filters && filters !== '{}' ? { 'match[]': filters } : {}),
    ...(limit ? { limit } : {}),
  };

  const response = await getBackendSrv().get<SuggestionsResponse>(url, params, 'metrics-drilldown-names');

  if (limit && response.warnings?.includes(LIMIT_REACHED)) {
    return { ...response, limitReached: true };
  }

  return { ...response, limitReached: false };
}

export async function getMetricNamesWithScopes(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  scopes: Scope[],
  filters: AdHocVariableFilter[],
  limit?: number
) {
  const response = await callSuggestionsApi(
    dataSourceUid,
    timeRange,
    scopes,
    filters,
    '__name__',
    limit,
    'metrics-drilldown-names'
  );

  return {
    ...response.data,
    limitReached: !!limit && !!response.data.warnings?.includes(LIMIT_REACHED),
  };
}

function removeBrackets(input: string): string {
  const match = input.match(/^\{(.*)\}$/); // extract the content inside the brackets
  return match?.[1] ?? '';
}
