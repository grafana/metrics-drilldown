import { type AdHocFiltersVariable, type AdHocFilterWithLabels } from '@grafana/scenes';

import { buildServiceFilter } from './serviceMatchers';

/**
 * Marks the filter that the sidebar writes into the top filters (VAR_FILTERS), so that the sidebar only ever replaces
 * or removes its own filter and never one that the user typed in the top bar for the same label.
 */
export const SERVICE_FILTER_SOURCE = 'sidebar-service';

function isManagedFilter(filter: AdHocFilterWithLabels, key: string) {
  // The variable types the meta of its filters as `{}`
  const meta: { source?: string } | undefined = filter.meta;

  return filter.key === key && meta?.source === SERVICE_FILTER_SOURCE;
}

/**
 * Returns the filters without the managed filter of the given key, e.g. to list the services that match the other
 * filters without shrinking the list to the services that are already selected.
 */
export function getFiltersWithoutManagedFilter(filters: AdHocFilterWithLabels[], key: string) {
  return filters.filter((filter) => !isManagedFilter(filter, key));
}

/**
 * Writes the selected values as one managed filter in the variable, in place of the previous managed filter for the
 * same key. An empty selection removes the managed filter. Filters that the sidebar did not write are never changed.
 * The variable is left untouched when the filter would not change, so that no query is refetched for nothing.
 */
export function setManagedServiceFilter(variable: AdHocFiltersVariable, key: string, values: string[]) {
  const { filters } = variable.state;
  const built = buildServiceFilter(key, values);
  const index = filters.findIndex((filter) => isManagedFilter(filter, key));

  if (!built) {
    if (index !== -1) {
      variable.setState({ filters: filters.filter((filter) => !isManagedFilter(filter, key)) });
    }
    return;
  }

  const managedFilter: AdHocFilterWithLabels = { ...built, meta: { source: SERVICE_FILTER_SOURCE } };

  if (index === -1) {
    variable.setState({ filters: [...filters, managedFilter] });
    return;
  }

  const current = filters[index];

  if (current.operator === managedFilter.operator && current.value === managedFilter.value) {
    return;
  }

  variable.setState({ filters: filters.map((filter, i) => (i === index ? managedFilter : filter)) });
}

export function removeManagedServiceFilter(variable: AdHocFiltersVariable, key: string) {
  setManagedServiceFilter(variable, key, []);
}

/**
 * Turns the managed filter of the given key into a plain filter that the sidebar no longer owns, and keeps it in the
 * top filters as it is. The filter editor of the top bar keeps the marker when the user edits the value or the operator
 * of a filter, so an edited filter would otherwise stay marked and still narrow the queries after the sidebar let go of it.
 */
export function releaseManagedServiceFilter(variable: AdHocFiltersVariable, key: string) {
  const { filters } = variable.state;

  if (!filters.some((filter) => isManagedFilter(filter, key))) {
    return;
  }

  variable.setState({
    filters: filters.map((filter) => {
      if (!isManagedFilter(filter, key)) {
        return filter;
      }

      const released = { ...filter };
      delete released.meta;

      return released;
    }),
  });
}

/**
 * Tells whether the variable still holds the managed filter that the selected values would produce.
 * It is false when the user deleted or edited the filter in the top bar, and when something cleared the filters
 * (e.g. switching to a binary query), in which case the sidebar must drop its selection.
 */
export function isServiceSelectionApplied(variable: AdHocFiltersVariable, key: string, values: string[]) {
  const built = buildServiceFilter(key, values);

  if (!built) {
    return false;
  }

  return variable.state.filters.some(
    (filter) => isManagedFilter(filter, key) && filter.operator === built.operator && filter.value === built.value
  );
}

/**
 * Marks an existing filter as managed when it equals the filter that the saved selection would produce.
 * The URL sync of the filters variable keeps only the key, operator and value of a filter, so the marker is lost on
 * reload and the sidebar claims the filter again from its own saved selection. A filter that the user typed with the
 * exact same key, operator and value has the same effect on every query, so claiming it changes no result.
 * Returns true when the selection is applied by a managed filter after the call.
 */
export function adoptServiceFilter(variable: AdHocFiltersVariable, key: string, values: string[]) {
  const built = buildServiceFilter(key, values);

  if (!built) {
    return false;
  }

  if (isServiceSelectionApplied(variable, key, values)) {
    return true;
  }

  const { filters } = variable.state;
  const index = filters.findIndex(
    (filter) =>
      !isManagedFilter(filter, key) &&
      filter.key === key &&
      filter.operator === built.operator &&
      filter.value === built.value
  );

  if (index === -1) {
    return false;
  }

  variable.setState({
    filters: filters.map((filter, i) =>
      i === index ? { ...filter, meta: { source: SERVICE_FILTER_SOURCE } } : filter
    ),
  });

  return true;
}
