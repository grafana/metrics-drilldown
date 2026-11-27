import { type AdHocFilterWithLabels, type SceneObject } from '@grafana/scenes';

import { localeCompare } from 'MetricsReducer/helpers/localCompare';
import { LabelsDataSource } from 'MetricsReducer/labels/LabelsDataSource';
import { buildFilterExpression } from 'shared/utils/utils.queries';

import { getFiltersWithoutManagedFilter } from './serviceFilterBridge';
import { JOB_LABEL, parseServicesFromJobs, type ServiceGroup } from './serviceMatchers';

/**
 * Builds the series matcher that narrows the label values to the series that match the top filters, without the
 * managed filter of `key`: the list of a tab must not shrink to the services that are already selected in it.
 * The managed filter of the other tab still applies, so both tabs describe the same set of series.
 * Returns undefined when no filter applies, because the Prometheus endpoints reject an empty matcher.
 * The `__name__` filters are left out for the same reason as in the expression of the top filters (see DataTrail.tsx).
 */
export function buildTopFiltersMatcher(filters: AdHocFilterWithLabels[], key: string): string | undefined {
  const expression = getFiltersWithoutManagedFilter(filters, key)
    .filter((filter) => filter.key !== '__name__')
    .map(buildFilterExpression)
    .join(',');

  return expression ? `{${expression}}` : undefined;
}

async function fetchSortedLabelValues(
  scene: SceneObject,
  filters: AdHocFilterWithLabels[],
  label: string
): Promise<string[]> {
  const values = await LabelsDataSource.fetchLabelValues(label, scene, buildTopFiltersMatcher(filters, label));

  return [...new Set(values.filter((value) => !isBlankValue(value)))].sort(localeCompare);
}

/**
 * A value made only of white space, control characters (such as \u0001) or invisible formatting characters (zero width
 * space, byte order mark, soft hyphen) has no visible label. Its row would look empty and its filter would match no
 * metric, so it is not listed.
 */
function isBlankValue(value: string) {
  return /^[\s\p{Cc}\p{Cf}]*$/u.test(value);
}

/**
 * Lists the services that the `job` label describes, with the jobs of each service (one per namespace), over the time
 * range of the scene. The data source is the one selected in the scene. A failure is reported as a warning and gives an
 * empty list.
 */
export async function fetchServiceGroups(
  scene: SceneObject,
  filters: AdHocFilterWithLabels[]
): Promise<ServiceGroup[]> {
  return parseServicesFromJobs(await fetchSortedLabelValues(scene, filters, JOB_LABEL));
}
