// Duplicated from logs-drilldown/src/Components/AttributeDistribution/attributeDistributionState.ts
// (also duplicated in sql-drilldown and app-o11y-kwl). This module is datasource-agnostic (pure
// reducer + helpers) and should be identical across drilldown apps.
// TODO: extract AttributeDistribution (this file + AttributeDistribution.tsx) into a shared library
// consumed by logs-drilldown, sql-drilldown, app-o11y-kwl, and metrics-drilldown instead of copying.

export interface AttributeConfig {
  attribute: string;
  attribute_name: string; // or display_name
}

export interface AttributeValueCount {
  count: number;
  // Rendered instead of `value` when present (e.g. "<unspecified>" for a genuinely absent label).
  // `value` itself must stay the raw, real value (e.g. "" for absent) since it's also what gets sent
  // to onToggleFilter -- a decorated display string there would produce a filter matcher that doesn't
  // match what it claims to (see PrometheusAttributeExplorer's UNSPECIFIED_LABEL_VALUE usage).
  displayValue?: string;
  // Opaque, adapter-populated context for an optional per-row tooltip (see getValueTooltip on
  // AttributeDistributionProps). Left undefined by adapters that have nothing extra to say.
  impliedTotal?: number;
  percentage: number;
  value: string;
}

export interface ActiveFilter {
  field: string;
  operator: '!=' | '=';
  value: string;
}

// A value entry extended with a `retained` flag used for the sticky values pattern.
export interface DisplayValue extends AttributeValueCount {
  // Values absent from the current filtered result, shown at 0% and dimmed.
  retained: boolean;
}

export interface AttributeState {
  error: string | false;
  expanded: boolean;
  loading: boolean;
  values: AttributeValueCount[];
}

export interface State {
  attributes: AttributeConfig[];
  data: Record<string, AttributeState>;
  detecting: boolean;
  // True when fetchAttributes itself failed (network/datasource/query error), as opposed to a dataset
  // that genuinely has no labels. Both look identical as "attributes.length === 0" otherwise, which
  // rendered the same "no fields detected" message for a real error as for an empty dataset.
  detectionError: boolean;
  selectedFilters: ActiveFilter[];
  // Attributes the user explicitly pinned via the search combobox.
  // Rendered between priority and non-priority fields, always visible.
  userPinnedAttributes: string[];
  // Snapshot of value lists per field, taken the moment the first filter is applied.
  // Retained until all filters are cleared. null when no filters are active.
  valueSnapshot: Record<string, AttributeValueCount[]> | null;
}

export type Action =
  | { isNewDataset: boolean; type: 'DETECTING' }
  | { type: 'DETECTION_ERROR' }
  | { configs: AttributeConfig[]; type: 'SET_ATTRIBUTES' }
  | { attributeLabels: Record<string, string>; priorityAttributes: string[]; type: 'REORDER_BY_PRIORITY' }
  | { field: string; type: 'LOADING' }
  | { field: string; type: 'LOADED'; values: AttributeValueCount[] }
  | { field: string; message: string; type: 'ERROR' }
  | { field: string; type: 'TOGGLE_EXPANDED' }
  | { attribute: string; type: 'PIN_ATTRIBUTE' }
  | { field: string; operator: '!=' | '='; type: 'TOGGLE_FILTER'; value: string }
  | { type: 'CLEAR_FILTERS' }
  | { filters: ActiveFilter[]; type: 'SET_FILTERS' };

// Computes the next filter list after a toggle action, shared by the reducer and
// handleToggleFilter (which needs the result synchronously before dispatch settles).
export function computeNextFilters(
  currentFilters: ActiveFilter[],
  field: string,
  value: string,
  operator: '!=' | '='
): ActiveFilter[] {
  const existingIndex = currentFilters.findIndex((f) => f.field === field && f.value === value);
  const existingForField = currentFilters.find((f) => f.field === field);

  if (existingIndex >= 0 && currentFilters[existingIndex].operator === operator) {
    // Same operator: deselect
    return currentFilters.filter((_, i) => i !== existingIndex);
  } else if (existingIndex >= 0) {
    // Operator switch for this value: clear all other values for the field to keep a single operator per field.
    return [...currentFilters.filter((f) => f.field !== field), { field, value, operator }];
  } else if (existingForField && existingForField.operator !== operator) {
    // Different operator already active for this field: clear and add new
    return [...currentFilters.filter((f) => f.field !== field), { field, value, operator }];
  } else {
    return [...currentFilters, { field, value, operator }];
  }
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- copied verbatim across all 4 repos, kept identical
export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'DETECTING': {
      const resetData: Record<string, AttributeState> = {};
      for (const [field, attrState] of Object.entries(state.data)) {
        // false, not true: only the first initialAutoLoadCount fields get an explicit LOADING dispatch
        // right away. A field beyond that batch (revealed later via "show more" or pinning) has no
        // fetch in flight yet, so defaulting it to true would spin forever until the user reveals it.
        resetData[field] = { error: false, expanded: attrState.expanded, loading: false, values: [] };
      }
      // Preserved (not unconditionally nulled) when this is the same dataset being refined, not a
      // genuinely new one: DETECTING re-runs on every context change, including a filter toggle or
      // time-range pan that leaves the underlying metric/datasource untouched, and this field's own
      // contract is "retained until all filters are cleared" -- not "retained until the next
      // re-detection cycle for any reason". See AttributeDistribution's run() effect for how
      // isNewDataset is derived.
      const valueSnapshot = action.isNewDataset ? null : state.valueSnapshot;
      return { ...state, data: resetData, detecting: true, detectionError: false, valueSnapshot };
    }
    case 'DETECTION_ERROR': {
      return { ...state, detecting: false, detectionError: true };
    }
    case 'SET_ATTRIBUTES': {
      const detectedFields = new Set(action.configs.map((c) => c.attribute));
      // Only preserve attributes the user explicitly pinned via the combobox.
      // Preserving all prior state.attributes would leak detected-only fields
      // from a previous context (different query or datasource) into the new one.
      const userPinned = state.userPinnedAttributes
        .filter((attr) => !detectedFields.has(attr))
        .map((attr) => state.attributes.find((a) => a.attribute === attr) ?? { attribute: attr, attribute_name: attr });
      const merged = [...action.configs, ...userPinned];
      const data: Record<string, AttributeState> = {};
      for (const c of merged) {
        // false, not true: see the identical reasoning in the DETECTING case above.
        data[c.attribute] = state.data[c.attribute] ?? { error: false, expanded: false, loading: false, values: [] };
      }
      return { ...state, attributes: merged, data, detecting: false, detectionError: false };
    }
    case 'REORDER_BY_PRIORITY': {
      // Re-sorts already-detected attributes in place when a fresh OTel priority list arrives after
      // the fact (e.g. a time-range or filter change re-runs priority detection independently of, and
      // often later than, attribute detection itself). Touches only `attributes` and `data` -- nothing
      // here resets selectedFilters, userPinnedAttributes, or valueSnapshot, unlike DETECTING/
      // SET_ATTRIBUTES, so the caller doesn't need to unmount and remount this component (losing all of
      // that) just to reflect an updated priority list.
      const reordered = orderByPriority(state.attributes, action.priorityAttributes, action.attributeLabels);
      const data: Record<string, AttributeState> = {};
      for (const c of reordered) {
        data[c.attribute] = state.data[c.attribute] ?? { error: false, expanded: false, loading: false, values: [] };
      }
      return { ...state, attributes: reordered, data };
    }
    case 'LOADING': {
      const existing = state.data[action.field];
      return {
        ...state,
        data: {
          ...state.data,
          // Keep existing values so bars remain visible during reload instead of collapsing.
          [action.field]: {
            error: false,
            expanded: existing?.expanded ?? false,
            loading: true,
            values: existing?.values ?? [],
          },
        },
      };
    }
    case 'LOADED':
      return {
        ...state,
        data: {
          ...state.data,
          [action.field]: {
            error: false,
            expanded: state.data[action.field]?.expanded ?? false,
            loading: false,
            values: action.values,
          },
        },
      };
    case 'ERROR':
      return {
        ...state,
        data: {
          ...state.data,
          [action.field]: {
            error: action.message,
            expanded: state.data[action.field]?.expanded ?? false,
            loading: false,
            values: [],
          },
        },
      };
    case 'TOGGLE_EXPANDED':
      return {
        ...state,
        data: {
          ...state.data,
          [action.field]: {
            ...state.data[action.field],
            expanded: !state.data[action.field]?.expanded,
          },
        },
      };
    case 'PIN_ATTRIBUTE':
      if (state.userPinnedAttributes.includes(action.attribute)) {
        return state;
      }
      return { ...state, userPinnedAttributes: [...state.userPinnedAttributes, action.attribute] };
    case 'TOGGLE_FILTER': {
      const { field, value, operator } = action;
      const newFilters = computeNextFilters(state.selectedFilters, field, value, operator);

      // Take a snapshot of current values when the first filter is added.
      let { valueSnapshot } = state;
      if (state.selectedFilters.length === 0 && newFilters.length > 0) {
        valueSnapshot = {};
        for (const [f, attrState] of Object.entries(state.data)) {
          valueSnapshot[f] = attrState.values;
        }
      }
      if (newFilters.length === 0) {
        valueSnapshot = null;
      }

      return { ...state, selectedFilters: newFilters, valueSnapshot };
    }
    case 'CLEAR_FILTERS':
      return { ...state, selectedFilters: [], valueSnapshot: null };
    case 'SET_FILTERS': {
      let { valueSnapshot } = state;
      if (action.filters.length === 0) {
        valueSnapshot = null;
      } else if (state.selectedFilters.length === 0 && valueSnapshot === null) {
        // Going from no filters to some: take a snapshot so retained values appear.
        valueSnapshot = {};
        for (const [f, attrState] of Object.entries(state.data)) {
          valueSnapshot[f] = attrState.values;
        }
      }
      return { ...state, selectedFilters: action.filters, valueSnapshot };
    }
    default:
      return state;
  }
}

export function orderByPriority(
  detected: AttributeConfig[],
  priority: string[],
  attributeLabels: Record<string, string>
): AttributeConfig[] {
  if (!priority.length) {
    return detected;
  }
  const detectedByField = new Map(detected.map((a) => [a.attribute, a]));
  // Only actually-detected fields, never a fallback placeholder for a priority field absent from
  // `detected`: the caller can retain a stale priority list across a same-dataset refresh (see
  // AttributeExplorerScene._resolveOtelPriority), so a field left over from a previous detection cycle
  // must not get manufactured into a permanent, never-populated section here -- it was previously
  // demoted, not removed, by the next reorder, since it doesn't belong to `priority` anymore either.
  // attributeLabels' canonical name is applied here unconditionally, not only in a fallback branch:
  // fetchAttributes assigns attribute_name as the raw label (e.g. "http_route"), so a genuinely-present
  // priority field never got its prettified canonical form ("http.route") before this.
  const priorityFirst = priority.flatMap((field) => {
    const config = detectedByField.get(field);
    return config ? [{ ...config, attribute_name: attributeLabels[field] ?? config.attribute_name }] : [];
  });
  const priorityFields = new Set(priority);
  const rest = detected.filter((a) => !priorityFields.has(a.attribute));
  return [...priorityFirst, ...rest];
}

// Attributes with a fully-loaded, fully-quiet value list (every value at count 0, or none detected)
// sort after every other attribute, so a genuinely inactive label doesn't sit above ones with real
// signal. An attribute still loading or currently erroring stays in its original position instead:
// its activity isn't known yet, and moving it the moment a fetch starts (then moving it back once data
// arrives) would just be UI jitter. A stable sort (guaranteed by Array.prototype.sort since ES2019)
// preserves relative order within each group, so this only ever demotes, never reshuffles arbitrarily.
export function sortByActivity(attributes: AttributeConfig[], data: Record<string, AttributeState>): AttributeConfig[] {
  const isConfirmedQuiet = (attribute: string): boolean => {
    const attrState = data[attribute];
    if (!attrState || attrState.loading || attrState.error) {
      return false;
    }
    // impliedTotal (this value's total observation count, in or out of range), not count (its in-range
    // count): a value can have real traffic that simply doesn't fall inside the current threshold,
    // which is a "0% of this label's in-range share" result, not "no activity". Checking count alone
    // would demote a label with genuine traffic just because none of it currently clears the
    // threshold, conflating "nothing matched the filter" with "this label is actually dead". Falls
    // back to count only for an adapter that never populates impliedTotal at all.
    return attrState.values.every((v) => (v.impliedTotal ?? v.count) === 0);
  };

  return [...attributes].sort((a, b) => {
    const aQuiet = isConfirmedQuiet(a.attribute);
    const bQuiet = isConfirmedQuiet(b.attribute);
    return aQuiet === bQuiet ? 0 : Number(aQuiet) - Number(bQuiet);
  });
}

// Merges current distribution values with snapshot values.
// Values in the snapshot but absent from current results are appended at 0%
// and marked retained; they remain visible and selectable after filtering.
export function mergeWithSnapshot(
  current: AttributeValueCount[],
  snapshot: AttributeValueCount[] | null
): DisplayValue[] {
  if (!snapshot) {
    return current.map((v) => ({ ...v, retained: false }));
  }
  const currentByValue = new Map(current.map((v) => [v.value, v]));
  const result: DisplayValue[] = current.map((v) => ({ ...v, retained: false }));
  for (const snap of snapshot) {
    if (!currentByValue.has(snap.value)) {
      // Carries displayValue through explicitly, not just the fields this branch already listed: a
      // retained absent-label row (value: "") would otherwise lose its "<unspecified>" label the
      // moment it's no longer in the live result set and falls into this snapshot-only branch.
      result.push({ value: snap.value, displayValue: snap.displayValue, count: 0, percentage: 0, retained: true });
    }
  }
  return result;
}
