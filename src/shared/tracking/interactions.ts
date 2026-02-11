import { type AdHocVariableFilter } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';

import { type ExposedComponentName } from 'exposedComponents/components';
import { getTrackedFlagPayload } from 'shared/featureFlags/tracking';
import { type PanelConfigPreset } from 'shared/GmdVizPanel/config/presets/types';
import { type MetricType } from 'shared/GmdVizPanel/matchers/getMetricType';
import { type PanelType } from 'shared/GmdVizPanel/types/available-panel-types';
import { type SortSeriesByOption } from 'shared/services/sorting';
import { type SnakeCase } from 'shared/utils/utils.types';

import { type ActionViewType } from '../../MetricScene/MetricActionBar';
import { type LayoutType } from '../../MetricsReducer/list-controls/LayoutSwitcher';
import { type SortingOption as MetricsReducerSortByOption } from '../../MetricsReducer/list-controls/MetricsSorter/MetricsSorter';
import { GIT_COMMIT } from '../../version';
import { PLUGIN_ID } from '../constants/plugin';

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
    // Whether any hierarchical filters (prefix:child format) are active
    has_hierarchical_filter?: boolean;
    // Number of hierarchical child filters active
    hierarchical_filter_count?: number;
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
  sidebar_recent_filter_section_clicked: {};
  sidebar_recent_filter_selected: { interval: string };
  // User expands a parent prefix to view children (hierarchical filtering)
  sidebar_hierarchical_prefix_opened: {
    prefix: string;
  };
  // User selects a child filter (Level 1 hierarchical)
  sidebar_hierarchical_child_filter_applied: {
    prefix: string;
    child: string;
  };
  app_initialized: {
    view: ViewName;
    uel_epid: string;
  };
  // User took an action to view an exposed component
  exposed_component_viewed: {
    component: SnakeCase<ExposedComponentName>;
  };
  // User selects a different layout (grid/rows/single)
  layout_changed: { layout: LayoutType };
  // User changes the panel type for a histogram metric (e.g., from heatmap to percentiles)
  histogram_panel_type_changed: { panelType: PanelType };
  // App migrated some legacy user prefs (see src/UserPreferences/userStorage.ts)
  user_preferences_migrated: {};
  // User opens the "Configure panel"
  configure_panel_opened: { metricType: MetricType };
  // User applies a panel config
  panel_config_applied: { metricType: MetricType; configId: string };
  // User restores the default panel config
  default_panel_config_restored: { metricType: MetricType };
  // An invalid metric config has been found
  invalid_metric_config: { metricConfig: PanelConfigPreset };
  // the user has clicked on the "Give feedback" button in the app header
  give_feedback_clicked: {};
  // User opens the "Add to Dashboard" modal
  add_to_dashboard_modal_opened: {};
  // User confirms to add to dashboard and builds a panel
  add_to_dashboard_build_panel: { expr: string };
  // User asks a question in the Quick Search input
  quick_search_assistant_question_asked: { question: string };
  // User enters assistant mode in the Quick Search input (e.g., by typing '?', clicking the AI button, or using the Tab+Enter keyboard flow)
  quick_search_assistant_mode_entered: { from: 'question_mark' | 'tab' | 'button' };
  // User opens the save query modal
  saved_query_save_modal_opened: {};
  // User successfully saves a query
  saved_query_saved: { source: 'local' | 'query_library' };
  // User opens the load query modal
  saved_query_load_modal_opened: {};
  // User toggles between saved queries in the load list
  saved_query_toggled: { source: 'local' | 'query_library' };
  // User deletes a saved query
  saved_query_deleted: { source: 'local' | 'query_library' };
  // User loads a saved query (localStorage)
  saved_query_loaded: {};
  // User loads a saved query from Query Library
  saved_query_loaded_from_library: {};
};

type OtherEvents = {
  extreme_value_filter_behavior_triggered: {
    expression: string;
  };
};

type AllEvents = Interactions & OtherEvents;

const INTERACTION_NAME_PREFIX = 'grafana_explore_metrics_';

function getExperimentPayloads<E extends keyof AllEvents>(event: E): Record<string, unknown> {
  const payloads: Record<string, unknown> = {};

  // Enrich all sidebar-related events (e.g., metrics_sidebar_toggled, sidebar_prefix_filter_applied)
  if (event.includes('sidebar')) {
    Object.assign(payloads, getTrackedFlagPayload('experiment_default_open_sidebar', true));
  }

  // Enrich only the metric_selected event to measure impact on metric selection behavior
  if (event === 'metric_selected') {
    Object.assign(payloads, getTrackedFlagPayload('experiment_hierarchical_prefix_filtering', true));
  }

  // Enrich assistant events to measure impact of the assistant quick search experiment
  if (event === 'quick_search_assistant_question_asked' || event === 'quick_search_assistant_mode_entered') {
    Object.assign(payloads, getTrackedFlagPayload('experiment_grafana_assistant_quick_search_tab_test', true));
  }

  return payloads;
}

function enrichPayload<E extends keyof AllEvents, P extends AllEvents[E]>(event: E, payload: P): P {
  return {
    ...payload,
    ...getExperimentPayloads(event),
    meta: {
      // same naming as Faro (see src/tracking/faro/faro.ts)
      appRelease: config.apps[PLUGIN_ID].version,
      appVersion: GIT_COMMIT,
    },
  };
}

export function reportExploreMetrics<E extends keyof AllEvents, P extends AllEvents[E]>(event: E, payload: P): void {
  reportInteraction(`${INTERACTION_NAME_PREFIX}${event}`, enrichPayload(event, payload));
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
