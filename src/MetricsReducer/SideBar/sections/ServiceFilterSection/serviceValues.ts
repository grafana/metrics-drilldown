import { type AdHocFilterWithLabels, type SceneObject } from '@grafana/scenes';

import { localeCompare } from 'MetricsReducer/helpers/localCompare';
import { LabelsDataSource } from 'MetricsReducer/labels/LabelsDataSource';
import { buildFilterExpression } from 'shared/utils/utils.queries';

import { getFiltersWithoutManagedFilter } from './serviceFilterBridge';
import { isBlankValue, JOB_LABEL, parseServicesFromJobs, type ServiceGroup } from './serviceMatchers';

/**
 * Builds the series matcher that narrows the label values to the series that match the top filters, without the
 * managed filter of `key`: the list must not shrink to the services that are already selected in it.
 * Returns undefined when no filter applies, because the Prometheus endpoints reject an empty matcher.
 * The `__name__` filters are left out for the same reason as in the expression of the top filters (see DataTrail.tsx).
 */
export function buildTopFiltersMatcher(filters: AdHocFilterWithLabels[], key: string): string | undefined {
  const expression = getFiltersWithoutManagedFilter(filters, key)
    .filter((filter) => filter.key !== '__name__')
    .map(buildFilterExpression)
    .join(',');

  // Prometheus rejects a selector whose matchers all accept the empty value (e.g. only `instance!="host-1"`), so an
  // always nonempty matcher comes first, as in LabelsVariable
  return expression ? `{__name__=~".+",${expression}}` : undefined;
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
