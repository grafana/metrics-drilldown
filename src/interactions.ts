import { type AdHocVariableFilter } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { type LabelBreakdownSortingOption as BreakdownSortByOption } from 'Breakdown/SortByScene';
import { type SortingOption as MetricsReducerSortByOption } from 'WingmanDataTrail/ListControls/MetricsSorter/MetricsSorter';

import { type BreakdownLayoutType } from './Breakdown/types';
import { type ActionViewType } from './MetricScene';

// prettier-ignore
export type Interactions = {
  // User selected a label to view its breakdown.
  label_selected: {
    label: string;
    cause: (
      // By clicking the "select" button on that label's breakdown panel
      | 'breakdown_panel'
      // By clicking on the label selector at the top of the breakdown
      | 'selector'
    );
    otel_resource_attribute?: boolean;
  };
  // User changed a label filter
  label_filter_changed: {
    label: string;
    action: 'added' | 'removed' | 'changed';
    cause: 'breakdown' | 'adhoc_filter';
    otel_resource_attribute?: boolean;
  };
  // User changed the breakdown layout
  breakdown_layout_changed: { layout: BreakdownLayoutType };
  // A metric exploration has started due to one of the following causes
  exploration_started: {
    cause: (
      // a bookmark was clicked from the home page
      | 'bookmark_clicked'
      // a recent exploration was clicked from the home page
      | 'recent_clicked'
      // "new exploration" was clicked from the home page
      | 'new_clicked'
      // the page was loaded (or reloaded) from a URL which matches one of the recent explorations
      | 'loaded_local_recent_url'
      // the page was loaded from a URL which did not match one of the recent explorations, and is assumed shared
      | 'loaded_shared_url'
      // the exploration was opened from the dashboard panel menu and is embedded in a drawer
      | 'dashboard_panel'
    );
  };
  // A user has changed a bookmark
  bookmark_changed: {
    action: (
      // Toggled on or off from the bookmark icon
      | 'toggled_on'
      | 'toggled_off'
      // Deleted from the homepage bookmarks list
      | 'deleted'
    );
  };
  // User changes metric explore settings
  settings_changed: { stickyMainGraph?: boolean };
  // User clicks on tab to change the action view
  metric_action_view_changed: { 
    view: ActionViewType 

    // The number of related logs
    related_logs_count?: number
  };
  // User clicks on one of the action buttons associated with a selected metric
  selected_metric_action_clicked: {
    action: (
      // Opens the metric queries in Explore
      | 'open_in_explore'
      // Clicks on the share URL button
      | 'share_url'
      // Deselects the current selected metrics by clicking the "Select new metric" button
      | 'unselect'
      // When in embedded mode, clicked to open the exploration from the embedded view
      | 'open_from_embedded'
    );
  };
  // User clicks on one of the action buttons associated with related logs
  related_logs_action_clicked: {
    action: (
      // Opens Explore Logs
      | 'open_explore_logs'
    );
  };
  // User selects a metric
  metric_selected: {
    from: (
      // By clicking "Select" on a metric panel when on the no-metric-selected metrics list view
      | 'metric_list'
      // By clicking "Select" on a metric panel when on the related metrics tab
      | 'related_metrics'
    );
    // The number of search terms activated when the selection was made
    searchTermCount: number | null;
  };
  // User opens/closes the prefix filter dropdown
  prefix_filter_clicked: {
    from: (
      // By clicking "Select" on a metric panel when on the no-metric-selected metrics list view
      | 'metric_list'
      // By clicking "Select" on a metric panel when on the related metrics tab
      | 'related_metrics'
    )
    action: (
      // Opens the dropdown
      | 'open'
      // Closes the dropdown
      | 'close'
    )
  };
  // User types in the quick search bar
  quick_search_used: {
  };
  sorting_changed: {
    // By clicking on the sort by variable in the metrics reducer
    from: 'metrics-reducer',
    // The sort by option selected
    sortBy: MetricsReducerSortByOption
  } | {
    // By clicking on the sort by component in the label breakdown
    from: 'label-breakdown',
    // The sort by option selected
    sortBy: BreakdownSortByOption
  };
  wasm_not_supported: {},
  missing_otel_labels_by_truncating_job_and_instance: {
    metric?: string;
  },
  deployment_environment_migrated: {},
  otel_experience_used: {},
  otel_experience_toggled: {
    value: ('on'| 'off')
  },
  native_histogram_examples_closed: {},
  native_histogram_example_clicked: {
    metric: string;
  },
  // User toggles the Wingman sidebar
  metrics_sidebar_toggled: {
    action: (
      // Opens the sidebar section
      | 'opened'
      // Closes the sidebar section
      | 'closed'
    ),
    section?: string
  },
  // User clicks into the prefix filter section of the sidebar
  sidebar_prefix_filter_section_clicked: {},
  // User applies any prefix filter from the sidebar
  sidebar_prefix_filter_applied: {
    // Number of prefix filters applied (optional)
    filter_count?: number;
  },
  // User clicks into the suffix filter section of the sidebar
  sidebar_suffix_filter_section_clicked: {},
  // User applies any suffix filter from the sidebar
  sidebar_suffix_filter_applied: {
    // Number of suffix filters applied (optional)
    filter_count?: number;
  },
  // User selects a rules filter from the Wingman sidebar
  sidebar_rules_filter_selected: {
    filter_type: (
      | 'non_rules_metrics'
      | 'recording_rules'
    )
  }
};

const PREFIX = 'grafana_explore_metrics_';

export function reportExploreMetrics<E extends keyof Interactions, P extends Interactions[E]>(event: E, payload: P) {
  reportInteraction(`${PREFIX}${event}`, payload);
}

/** Detect the single change in filters and report the event, assuming it came from manipulating the adhoc filter */
export function reportChangeInLabelFilters(
  newFilters: AdHocVariableFilter[],
  oldFilters: AdHocVariableFilter[],
  otel?: boolean
) {
  if (newFilters.length === oldFilters.length) {
    for (const oldFilter of oldFilters) {
      for (const newFilter of newFilters) {
        if (oldFilter.key === newFilter.key) {
          if (oldFilter.value !== newFilter.value) {
            reportExploreMetrics('label_filter_changed', {
              label: oldFilter.key,
              action: 'changed',
              cause: 'adhoc_filter',
              otel_resource_attribute: otel ?? false,
            });
          }
        }
      }
    }
  } else if (newFilters.length < oldFilters.length) {
    for (const oldFilter of oldFilters) {
      let foundOldLabel = false;
      for (const newFilter of newFilters) {
        if (oldFilter.key === newFilter.key) {
          foundOldLabel = true;
          break;
        }
      }
      if (!foundOldLabel) {
        reportExploreMetrics('label_filter_changed', {
          label: oldFilter.key,
          action: 'removed',
          cause: 'adhoc_filter',
        });
      }
    }
  } else {
    for (const newFilter of newFilters) {
      let foundNewLabel = false;
      for (const oldFilter of oldFilters) {
        if (oldFilter.key === newFilter.key) {
          foundNewLabel = true;
          break;
        }
      }
      if (!foundNewLabel) {
        reportExploreMetrics('label_filter_changed', { label: newFilter.key, action: 'added', cause: 'adhoc_filter' });
      }
    }
  }
}
