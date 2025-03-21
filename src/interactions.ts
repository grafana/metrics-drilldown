import { type AdHocVariableFilter } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

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
  // User changed a label filter.
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
    view: ActionViewType;
    // The number of related logs
    related_logs_count?: number;
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
    );
    action: (
      // Opens the dropdown
      | 'open'
      // Closes the dropdown
      | 'close'
    );
  };
  sorting_changed: {
    // type of sorting
    sortBy: string;
  };
  wasm_not_supported: {};
  missing_otel_labels_by_truncating_job_and_instance: {
    metric?: string;
  };
  deployment_environment_migrated: {};
  otel_experience_used: {};
  otel_experience_toggled: {
    value: 'on' | 'off';
  };
  native_histogram_examples_closed: {};
  native_histogram_example_clicked: {
    metric: string;
  };
};

export function reportExploreMetrics(eventName: string, properties: Record<string, unknown>) {
  reportInteraction('grafana_explore_metrics_' + eventName, properties);
}

export function reportChangeInLabelFilters(
  newFilters: AdHocVariableFilter[],
  prevFilters: AdHocVariableFilter[],
  isOtelResource?: boolean
) {
  const addedFilters = newFilters.filter((f) => !prevFilters.includes(f));
  const removedFilters = prevFilters.filter((f) => !newFilters.includes(f));
  const changedFilters = newFilters.filter(
    (f) => !addedFilters.includes(f) && !removedFilters.includes(f) && !prevFilters.includes(f)
  );

  if (addedFilters.length > 0) {
    addedFilters.forEach((filter) => {
      reportInteraction('label_filter_changed', {
        label: filter.key,
        action: 'added',
        cause: 'adhoc_filter',
        otel_resource_attribute: isOtelResource,
      });
    });
  }

  if (removedFilters.length > 0) {
    removedFilters.forEach((filter) => {
      reportInteraction('label_filter_changed', {
        label: filter.key,
        action: 'removed',
        cause: 'adhoc_filter',
        otel_resource_attribute: isOtelResource,
      });
    });
  }

  if (changedFilters.length > 0) {
    changedFilters.forEach((filter) => {
      reportInteraction('label_filter_changed', {
        label: filter.key,
        action: 'changed',
        cause: 'adhoc_filter',
        otel_resource_attribute: isOtelResource,
      });
    });
  }
}
