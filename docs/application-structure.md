# Application Structure

This document describes the user experience and interaction patterns in the Metrics Drilldown app. It follows the typical user journey from entry to exploring metrics data and navigating to other parts of Grafana.

## Entry Points

Users can arrive at Metrics Drilldown through several paths:

### Sidebar Navigation

The primary entry point is the Metrics Drilldown icon in Grafana's sidebar navigation. This loads the metrics list view for the default data source.

### Extension Links

Users can navigate to Metrics Drilldown from other parts of Grafana via extension links:

- From Explore: A toolbar action appears when examining metrics with a Prometheus-compatible data source
- From dashboard panels: A panel menu action appears for panels using Prometheus-compatible queries
- From alert rules: A link appears in the alert rule query editor for Prometheus-based alerts
- From data source configuration: Action and status links on the Prometheus data source configuration page provide quick access to browse that data source's metrics
- From Grafana Assistant: Assistant can navigate users to Metrics Drilldown when answering metrics-related questions

### Embedded Components

Metrics Drilldown can be embedded in dashboards or other apps through exposed components like `SourceMetrics` and `MiniBreakdown`. These provide scoped views that can link to the full app experience.

### Direct URLs

Deep links enable jumping directly to specific metrics or filtered views. URLs preserve the selected metric, active tab, filters, and time range, making it easy to share specific views with teammates.

## The Metrics List View

Upon entering Metrics Drilldown, users see a browsable list or grid of available metrics from the selected data source. This is designed as a starting point for metric exploration, balancing simplicity with powerful filtering capabilities through progressive disclosure.

### Top Controls

The toolbar provides essential controls for working with metrics:

- Data source selector: Choose which Prometheus-compatible data source to explore
- Time range picker: Control the time window for all visualizations
- Search bar: Filter metrics by name using plaintext search. Advanced users can use regex patterns (e.g., `/^node_/`) for more precise matching. In environments with Grafana Assistant enabled, typing `?` opens Assistant for natural language queries
- Sort dropdown: Order metrics alphabetically (A-Z or Z-A), by default (alphabetical with recently-selected first), or by usage frequency in dashboards and alerts
- Layout toggle: Switch between grid and rows layouts for viewing metrics
- Auto-refresh: Enable periodic refreshing at a chosen interval

### Sidebar

The collapsible sidebar provides a graphical way to filter and navigate metrics. Users who want to narrow down the metrics list can open it to access:

#### Rules filters

For environments using Prometheus recording rules, this groups metrics by their originating rules, making it easy to find all metrics derived from a particular recording rule hierarchy.

#### Prefix filters

Filter metrics based on common prefixes (e.g., `node_`, `prometheus_`) to find metrics from specific exporters or subsystems.

#### Suffix filters

Filter metrics based on common suffixes (e.g., `_total`, `_seconds`) to identify metric types like counters or histograms.

#### Recent metrics filters

Filter the metrics list to show only newly-created metrics from a chosen time window (past 1m, 3m, 5m, etc.). This helps users discover metrics that were recently added to the data source.

#### Group by labels

A two-level drill-down for filtering by label values:

1. First, select a label name (like `job` or `instance`)
2. Then, select specific values for that label

#### Bookmarks

Quick access to saved metrics. Bookmarks persist across sessions, helping users return to frequently monitored metrics.

All filters show counts of matching metrics and can be combined. Selections are saved in user preferences and restored on return visits.

## Selecting and Viewing a Metric

Clicking a metric from the list opens a detailed view with the metric's visualization and additional context. The app automatically selects the most appropriate visualization type based on the metric's characteristics:

- Counters (like `requests_total`) show rate-of-change over time as timeseries
- Gauges (like `temperature_celsius`) show raw values as timeseries
- Histograms (like `request_duration_seconds`) show distribution heatmaps
- Status metrics (like `up`) show status history with color-coded indicators
- Info metrics (like `node_info`) show counts over time as timeseries

This automatic query and visualization selection means users don't need to write PromQL or choose panel types manually.

### Panel Actions

The metric panel provides contextual actions in its header and menu:

#### Header actions

- Configure: Modify the PromQL function applied (e.g., switch between `rate()`, `increase()`, or aggregations)
- Open Assistant: Ask questions about the metric using Grafana Assistant (if available)
- Add to Dashboard: Insert this metric panel into a new or existing dashboard
- Bookmark: Save the metric for quick access via the sidebar

#### Panel menu

- Open in Explore: Jump to Grafana Explore with this metric and its context
- Copy URL: Get a shareable link to this exact view

### Actions bar

Three tabs provide different perspectives on the metric, helping users understand it more deeply without requiring query expertise.

#### Breakdown Tab

The Breakdown tab helps users understand how a metric is composed across different dimensions. This is particularly useful for aggregated metrics where you want to see contributing sources.

##### Group by label

A dropdown lets users select which label to break down by. Choosing "All" shows a panel for each available label name (showing the metric aggregated by that label), while selecting a specific label (like `instance` or `pod`) shows a panel for each value of that label.

##### Visual Interaction

- Clicking a panel applies that label or value as a filter, narrowing the focus
- The control bar stays visible while scrolling through many panels

When investigating a spike in `api_requests_total`, users can break down by `endpoint` to see which endpoints are responsible, then drill down to specific endpoint values to see individual instances.

#### Related Metrics Tab

The Related Metrics tab surfaces metrics that are likely relevant based on name similarity. This aids discovery without requiring users to know the full metric catalog.

##### How relatedness works

Metrics are sorted by how similar their names are to the current metric using string similarity (Levenshtein distance). The algorithm compares both the first half of the metric name and the full name to find metrics with similar naming patterns.

For example, when viewing `node_network_receive_bytes_total`, related metrics might include `node_network_transmit_bytes_total`, `node_network_receive_packets_total`, and other metrics with similar name structure.

##### Controls

Users can search within related metrics or filter by prefix to narrow the set further. A layout switcher allows toggling between grid and rows view.

When viewing `http_requests_total`, related metrics will include others with similar names like `http_request_duration_seconds`, `http_request_size_bytes`, and `http_response_size_bytes`, helping users build a complete picture of HTTP behavior.

#### Related Logs Tab

The Related Logs tab connects metrics to relevant log streams based on shared labels, bridging the gap between metrics and logs observability.

##### How It Works

The app analyzes the metric's labels and searches for log streams with overlapping labels. For metrics derived from recording rules, it also checks if logs exist for the underlying recorded expression.

##### Display

A count shows how many related log streams were found. Users can click through to explore those logs in Grafana Explore or Logs Drilldown.

##### UX Consideration

The log counting happens in the background after the metric visualization loads, ensuring users aren't waiting on log queries when their primary interest is the metric.

When troubleshooting high latency in `request_duration_seconds`, users can jump to logs from the same `pod` and `namespace` labels to see error messages or detailed request traces.

## Exit Points

Metrics Drilldown connects to the broader Grafana ecosystem through several exit points:

### Add to Dashboard

Takes the current metric visualization and adds it to a dashboard, preserving the query, time range, and visualization settings. Users can add to an existing dashboard or create a new one.

### Open in Explore

Navigates to Grafana Explore with the metric and its context (filters, time range) pre-populated. This is useful for users who want to write custom queries or perform ad-hoc analysis.

### Open Logs in Logs Drilldown

From the Related Logs tab, users can navigate to Logs Drilldown with the appropriate label filters already applied.

### Bookmarking Metrics

While not strictly an exit point, bookmarks let users mark important metrics for quick return access, reducing the need to search or filter repeatedly.

### URL Sharing

The URL updates as users navigate and apply filters, making it simple to copy and share specific views with teammates. Recipients land in exactly the same state: same metric, filters, tab, and time range.

## Embedded Mode Variations

Metrics Drilldown components can be embedded in other contexts with adapted UIs:

### RCA Workbench

The `SourceMetrics` component is embedded in RCA Workbench's slide-out drawer to allow users to explore the metrics that are related to a Knowledge Graph Insight.

### Compact Views

The `MiniBreakdown` component is embedded in RCA Workbench to allow users to explore the metrics that are related to a Knowledge Graph Insight.

### Linking Back

Embedded components may provide links to open the full Metrics Drilldown experience when users need more advanced filtering or analysis capabilities.
