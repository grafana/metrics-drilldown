import { dateMath, locationUtil, serializeStateToUrlParam, type AdHocVariableFilter } from '@grafana/data';
import { type PromQuery } from '@grafana/prometheus';

import { type MetricHandoffProps } from './types';
import { buildMiniBreakdownNavigationUrl } from '../MiniBreakdown/buildNavigationUrl';

export interface MetricHandoffLinks {
  explore?: string;
  drilldown?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSupportedName(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    !/["'`\\{}$]/.test(value) &&
    !value.includes('[[') &&
    !Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  );
}

function hasReservedFilterUrlToken(value: string): boolean {
  return /__gf[pch]__/.test(value);
}

// AdHocFiltersVariableUrlSyncHandler's public serializer drops empty-value matchers. Mirror
// its delimiter escaping locally to preserve them without changing app navigation helpers.
function escapeFilterUrlDelimiters(value: string): string {
  return value.replaceAll('|', '__gfp__').replaceAll(',', '__gfc__').replaceAll('#', '__gfh__');
}

function isSupportedFilter(filter: AdHocVariableFilter): boolean {
  return (
    filter != null &&
    isSupportedName(filter.key) &&
    !hasReservedFilterUrlToken(filter.key) &&
    ['=', '!=', '=~', '!~'].includes(filter.operator) &&
    typeof filter.value === 'string' &&
    // The destination still treats two quotes as an empty sentinel and interpolates templates.
    filter.value !== '""' &&
    !/\$(?:\w|\{)|\[\[/.test(filter.value) &&
    !hasReservedFilterUrlToken(filter.value) &&
    // The navigation builder supports single matchers, not multi-value or boolean filter groups.
    filter.values === undefined &&
    // eslint-disable-next-line sonarjs/deprecation, @typescript-eslint/no-deprecated -- Validate legacy input rather than silently dropping boolean filter groups.
    [undefined, '', 'AND'].includes(filter.condition)
  );
}

function parseTime(value: string | number, roundUp: boolean) {
  if (typeof value !== 'number' && !isNonEmptyString(value)) {
    return undefined;
  }
  const absolute = typeof value === 'number' || /^-?\d+$/.test(value);
  const parsed = dateMath.toDateTime(absolute ? new Date(Number(value)) : value, { roundUp });
  return parsed?.isValid() ? parsed : undefined;
}

function isScopedQuery(query: PromQuery, dataSourceUid: string): boolean {
  return (
    query != null &&
    isNonEmptyString(query.expr) &&
    isNonEmptyString(query.refId) &&
    (!query.datasource?.uid || query.datasource.uid === dataSourceUid) &&
    (!query.datasource?.type || query.datasource.type === 'prometheus')
  );
}

/** Pure link construction: no scene ancestry, expression decomposition or location mutation. */
export function buildMetricHandoffLinks(props: MetricHandoffProps): MetricHandoffLinks {
  const { dataSourceUid, from, to, queries, filters = [], metric, groupBy } = props;
  const start = parseTime(from, false);
  const end = parseTime(to, true);
  if (!isNonEmptyString(dataSourceUid) || !start || !end || start.valueOf() > end.valueOf()) {
    return {};
  }

  const links: MetricHandoffLinks = {};
  if (
    Array.isArray(queries) &&
    queries.length > 0 &&
    queries.every((query) => isScopedQuery(query, dataSourceUid)) &&
    new Set(queries.map((query) => query.refId)).size === queries.length
  ) {
    const state = serializeStateToUrlParam({
      datasource: dataSourceUid,
      queries: queries.map((query) => ({
        ...query,
        datasource: { ...query.datasource, type: 'prometheus', uid: dataSourceUid },
      })),
      range: { from: String(from), to: String(to) },
    });
    links.explore = locationUtil.assureBaseUrl(`/explore?left=${encodeURIComponent(state)}`);
  }

  if (
    isSupportedName(metric) &&
    (groupBy === undefined || isSupportedName(groupBy)) &&
    Array.isArray(filters) &&
    filters.every(isSupportedFilter)
  ) {
    links.drilldown = locationUtil.assureBaseUrl(
      buildMiniBreakdownNavigationUrl({
        metric,
        labels: filters.map(({ key, operator, value }) => ({
          label: escapeFilterUrlDelimiters(key),
          op: operator,
          value: escapeFilterUrlDelimiters(value),
        })),
        dataSource: dataSourceUid,
        from: String(from),
        to: String(to),
        groupBy,
      })
    );
  }
  return links;
}
