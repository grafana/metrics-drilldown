import { type AdHocVariableFilter } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';

import { type ExposedComponentName } from 'exposedComponents/components';
import { type ActionViewType } from 'MetricActionBar';
import { type SortSeriesByOption } from 'services/sorting';
import { type SnakeCase } from 'utils/utils.types';
import { type LayoutType } from 'WingmanDataTrail/ListControls/LayoutSwitcher';
import { type SortingOption as MetricsReducerSortByOption } from 'WingmanDataTrail/ListControls/MetricsSorter/MetricsSorter';

import { PLUGIN_ID } from './constants';
import { GIT_COMMIT } from './version';

export type ViewName = 'metrics-reducer' | 'metric-details';

type Interactions = {
  // User selected a label to view its breakdown.
  groupby_label_changed: {
    label: string;
  };
  breakdown_panel_selected: {
    label: string;
  };
  // User changed a label filter
  label_filter_changed: {
    label: string;
    action: 'added' | 'removed' | 'changed';
    cause: 'breakdown' | 'adhoc_filter';
  };
  // User changed the breakdown layout
  breakdown_layout_changed: { layout: LayoutType };
  // A metric exploration has started due to one of the following causes
  exploration_started: {
    cause: 'bookmark_clicked';
  };
  // A user has changed a bookmark
  bookmark_changed: {
    action: // Toggled on or off from the bookmark icon
    | 'toggled_on'
      | 'toggled_off'
      // Deleted from the sidebar bookmarks list
      | 'deleted';
  };
  // User changes metric explore settings
  settings_changed: { stickyMainGraph?: boolean };
  // User clicks on tab to change the action view
  metric_action_view_changed: {
    view: ActionViewType;

    // The number of related logs
    related_logs_count?: number;
  };
  // User clicks on one of the action buttons associated with a selected metric
  selected_metric_action_clicked: {
    action: // Opens the metric queries in Explore
    | 'open_in_explore'
      // Clicks on the share URL button
      | 'share_url'
      // Deselects the current selected metrics by clicking the "Select new metric" button
      | 'unselect'
      // When in embedded mode, clicked to open the exploration from the embedded view
      | 'open_from_embedded';
  };
  // User clicks on one of the action buttons associated with related logs
  related_logs_action_clicked: {
    action: // Opens Logs Drilldown
    | 'open_logs_drilldown'
      // Logs data source changed
      | 'logs_data_source_changed';
  };
  // User selects a metric
  metric_selected: {
    from: // By clicking "Select" on a metric panel when on the no-metric-selected metrics list view
    | 'metric_list'
      // By clicking "Select" on a metric panel when on the related metrics tab
      | 'related_metrics';
    // The number of search terms activated when the selection was made
    searchTermCount: number | null;
  };
  // User opens/closes the prefix filter dropdown
  prefix_filter_clicked: {
    from: // By clicking "Select" on a metric panel when on the no-metric-selected metrics list view
    | 'metric_list'
      // By clicking "Select" on a metric panel when on the related metrics tab
      | 'related_metrics';
    action: // Opens the dropdown
    | 'open'
      // Closes the dropdown
      | 'close';
  };
  // User types in the quick search bar
  quick_search_used: {};
  sorting_changed:
    | {
        // By clicking on the sort by variable in the metrics reducer
        from: 'metrics-reducer';
        // The sort by option selected
        sortBy: MetricsReducerSortByOption;
      }
    | {
        // By clicking on the sort by component in the label breakdown
        from: 'label-breakdown';
        // The sort by option selected
        sortBy: SortSeriesByOption;
      };
  wasm_not_supported: {};
  native_histogram_examples_closed: {};
  native_histogram_example_clicked: {
    metric: string;
  };
  // User toggles the Wingman sidebar
  metrics_sidebar_toggled: {
    action: // Opens the sidebar section
    | 'opened'
      // Closes the sidebar section
      | 'closed';
    section?: string;
  };
  // User clicks into the prefix filter section of the sidebar
  sidebar_prefix_filter_section_clicked: {};
  // User applies any prefix filter from the sidebar
  sidebar_prefix_filter_applied: {
    // Number of prefix filters applied (optional)
    filter_count?: number;
  };
  // User clicks into the suffix filter section of the sidebar
  sidebar_suffix_filter_section_clicked: {};
  // User applies any suffix filter from the sidebar
  sidebar_suffix_filter_applied: {
    // Number of suffix filters applied (optional)
    filter_count?: number;
  };
  // User selects a rules filter from the Wingman sidebar
  sidebar_rules_filter_selected: {
    filter_type: 'non_rules_metrics' | 'recording_rules';
  };
  // User applies a label filter from the sidebar
  sidebar_group_by_label_filter_applied: {
    label: string;
  };
  app_initialized: {
    view: ViewName;
  };
  // User took an action to view an exposed component
  exposed_component_viewed: {
    component: SnakeCase<ExposedComponentName>;
  };
  // App migrated some legacy user prefs (see src/UserPreferences/userPreferences.ts)
  user_preferences_migrated: {};
  // User clicks on the "Configure panel" button on the panel
  configure_panel_clicked: {};
  // User applies a panel config
  panel_config_applied: {};
  // User restores the default panel config
  default_panel_config_restored: {};
  // User selects a panel config
  panel_config_selected: {
    presetId: string;
  };
};

type OtherEvents = {
  extreme_value_filter_behavior_triggered: {
    expression: string;
  };
};

type AllEvents = Interactions & OtherEvents;

const INTERACTION_NAME_PREFIX = 'grafana_explore_metrics_';

export function reportExploreMetrics<E extends keyof AllEvents, P extends AllEvents[E]>(event: E, payload: P) {
  reportInteraction(`${INTERACTION_NAME_PREFIX}${event}`, {
    ...payload,
    meta: {
      // same naming as Faro (see src/tracking/faro/faro.ts)
      appRelease: config.apps[PLUGIN_ID].version,
      appVersion: GIT_COMMIT,
    },
  });
}

/**
 * Reports a single label filter change event
 */
function reportLabelFilterChange(label: string, action: 'added' | 'removed' | 'changed') {
  reportExploreMetrics('label_filter_changed', {
    label,
    action,
    cause: 'adhoc_filter',
  });
}

/**
 * Detects and reports changes to an existing filter
 */
function detectChangedFilters(newFilters: AdHocVariableFilter[], oldFilters: AdHocVariableFilter[]) {
  for (const oldFilter of oldFilters) {
    for (const newFilter of newFilters) {
      if (oldFilter.key === newFilter.key && oldFilter.value !== newFilter.value) {
        reportLabelFilterChange(oldFilter.key, 'changed');
      }
    }
  }
}

/**
 * Detects and reports removed filters
 */
function detectRemovedFilters(newFilters: AdHocVariableFilter[], oldFilters: AdHocVariableFilter[]) {
  for (const oldFilter of oldFilters) {
    const stillExists = newFilters.some((newFilter) => newFilter.key === oldFilter.key);
    if (!stillExists) {
      reportLabelFilterChange(oldFilter.key, 'removed');
    }
  }
}

/**
 * Detects and reports added filters
 */
function detectAddedFilters(newFilters: AdHocVariableFilter[], oldFilters: AdHocVariableFilter[]) {
  for (const newFilter of newFilters) {
    const isNew = !oldFilters.some((oldFilter) => oldFilter.key === newFilter.key);
    if (isNew) {
      reportLabelFilterChange(newFilter.key, 'added');
    }
  }
}

/** Detect the single change in filters and report the event, assuming it came from manipulating the adhoc filter */
export function reportChangeInLabelFilters(newFilters: AdHocVariableFilter[], oldFilters: AdHocVariableFilter[]) {
  if (newFilters.length === oldFilters.length) {
    // Same number of filters - check for changed values
    detectChangedFilters(newFilters, oldFilters);
  } else if (newFilters.length < oldFilters.length) {
    // Filters were removed
    detectRemovedFilters(newFilters, oldFilters);
  } else {
    // Filters were added
    detectAddedFilters(newFilters, oldFilters);
  }
}
