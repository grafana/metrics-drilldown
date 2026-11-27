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

#### Category filters

Group metrics into OpenTelemetry style categories such as HTTP, Database, or Kubernetes. Each category shows the number of matching metrics, and selecting several categories shows the metrics of any of them. A metric belongs to a category when its name starts with one of the category prefixes followed by `_` or `.`, so `k8s_pod_info` and `k8s.pod.info` are both Kubernetes. The categories and prefixes mirror the attribute categories of the Grafana trace view and are defined in `src/MetricsReducer/metrics-variables/metricCategories.ts`.

The match is fuzzy, so a metric can land in a category that does not fit it. Metrics that match no prefix (e.g., `node_` or `kube_`) appear under Other.

#### Service filters

Narrow the metrics list to one or more services. The section shows one list of checkboxes with a search field and a count of the selected services. Every selection is stored as the exact values of the `job` label, because the filter has to match metrics and Prometheus sets `job` on every scraped series. In Prometheus a job is a group of scrape targets with the same purpose. Prometheus with OpenTelemetry sets `job` to `<service.namespace>/<service.name>`, or to `<service.name>` when the service has no namespace. A job can also name infrastructure such as an exporter, so the job label alone cannot tell a service from an exporter.

The section asks two sources, and both rest on the `job` label:

- The job label of the selected data source says which job values exist, so which filters can match metrics. The section always fetches these values, and it names a service after the part of its job that follows the first slash. One service can have several jobs, one per namespace, and selecting a service selects all of its jobs. The first slash is a heuristic, so a job that does not come from OpenTelemetry, such as `integrations/kubernetes/kubelet`, shows as `kubernetes/kubelet`.
- The Knowledge Graph says which jobs are services. It is asked only when the stack has a Knowledge Graph data source. The request is one `property_values` call for the distinct `job` values of the Service entities with the `service_type` property `instrumented`, over the selected time range, for up to 10,000 jobs. When it returns that many, the list shows a notice that it may be incomplete.

The list is chosen this way:

- With a Knowledge Graph that lists services, the list holds the Knowledge Graph services and the caption reads "Services from the Knowledge Graph". Only the jobs that exist in the selected data source are kept, and a service left without such a job is dropped, because its filter would match no metric. When the job label has jobs that the Knowledge Graph does not list, the checkbox "Include all jobs" appears below the caption. Checking it adds those jobs. A job whose service name is the name of a Knowledge Graph service joins the row of that service, whatever its namespace, so the name is listed once and selecting the row selects all of its jobs. A row is shown as partly selected when only some of its jobs are selected. The other jobs are listed under the heading "Other jobs", below the Knowledge Graph services. Checking the box makes no new request, because the jobs are already loaded. Unchecking it removes the added jobs from the rows and from the selection, so that the filter never applies jobs that the list no longer shows. The choice is kept in the URL key `filters-service-more`.
- Without a Knowledge Graph data source, or when its request fails, the list holds the services read from the job label and the caption reads "No Knowledge Graph found, so services are read from the job label". A failed request is not shown to the user, because a Grafana outside of Grafana Cloud has no Knowledge Graph to answer. It is logged with `logger.error`.
- When the Knowledge Graph lists no service that has a job in the selected data source, the list also holds the services read from the job label, and the caption reads "The Knowledge Graph lists no services for this data source, so services are read from the job label".

An info button next to the caption explains where the list comes from, with links to the Prometheus definition of jobs and instances, the OpenTelemetry Prometheus compatibility specification, the Grafana Cloud OTLP format considerations and the Knowledge Graph introduction.

The lists are fetched the first time you open the section. They are fetched again when the other filters at the top of the app change or when you pick another time range. Auto refresh does not fetch them again. An empty list and a failed Knowledge Graph request are not remembered, so the next change of the filters or of the time range tries again.

A selection adds one filter to the label filters at the top of the app, and `job` matches the exact selected values. Because every query reads those label filters, the filter applies to the metrics list, the recent metrics, the metric panels, and the metric view. The selection is stored in the URL key `filters-service-job`, with the values separated by commas and a backslash before any comma or backslash inside a value.

A filter that you add yourself at the top of the app for `job` also applies, and the results match both. If you already added the exact same filter, the sidebar takes it over. Removing the sidebar's filter from the top of the app clears the selection. A binary query clears all filters at the top of the app, so it clears the selection too, and changing the data source clears it as well, because services belong to a data source.

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

The main metric panel provides contextual actions in its header and menu. Panels for individual label values, such as those in the Breakdown tab, only get the Open in Explore menu item; the rest of this section describes the main panel.

#### Header actions

- Configure: Modify the PromQL function applied (e.g., switch between `rate()`, `increase()`, or aggregations)
- Visualization variant: For histogram metrics, switch between percentile and heatmap views

#### Panel menu

- Open in Explore: Jump to Grafana Explore with this metric and its context
- Explain in Assistant: Ask questions about the metric using Grafana Assistant (if available)
- Add to Dashboard: Insert this metric panel into a new or existing dashboard (if available)
- Create Alert: Create an alert rule for this metric (if available)
- Bookmark: Save the metric for quick access via the sidebar
- Copy URL: Get a shareable link to this exact view

### Actions bar

Three tabs provide different perspectives on the metric, helping users understand it more deeply without requiring query expertise.

#### Breakdown Tab

The Breakdown tab helps users understand how a metric is composed across different dimensions. This is particularly useful for aggregated metrics where you want to see contributing sources.

##### Group by label

A dropdown lets users select which label to break down by. Choosing "All" shows a panel for each available label name (showing the metric aggregated by that label), while selecting a specific label (like `instance` or `pod`) shows a panel for each value of that label.

##### Histogram breakdown function

For histogram metrics, a "Function" selector controls how each label's breakdown is aggregated: sum (the default, each label's total value per second) or a percentile (p99, p95, p75, p50).

##### Sync y-axis

A "Sync y-axis" switch, next to the layout control, controls whether the panels share one y-axis range. It's on by default, which helps users scan many panels and spot the one that stands out. Turning it off scales each panel to its own data, so the shape of each series stays readable even when one panel's values are much larger than the others. The setting is saved in the browser and applies to every metric. The switch is hidden in the Single layout because there's only one panel.

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

### Create an Alert

Navigates to the Grafana Alert form with the query and datasource pre-populated. This is useful when exploring metrics and creating an alert based on the exploration.

### Open Logs in Logs Drilldown

From the Related Logs tab, users can navigate to Logs Drilldown with the appropriate label filters already applied.

### URL Sharing

The URL updates as users navigate and apply filters, making it simple to copy and share specific views with teammates. Recipients land in exactly the same state: same metric, filters, tab, and time range.

## Embedded Mode Variations

Metrics Drilldown components can be embedded in other contexts with adapted UIs:

### RCA Workbench

The `SourceMetrics` component is embedded in RCA Workbench's slide-out drawer to allow users to explore the metrics that are related to a Knowledge Graph Insight.

### Compact Views

The `MiniBreakdown` component is embedded in Grafana Assistant to allow users to preview a label breakdown of a metric in the Assistant UI before opening the full Metrics Drilldown experience. In this compact mode, the main panel's header actions and menu (Configure, Explore, Add to Dashboard, and so on) are hidden, since the preview is meant to be a minimal, click-through summary rather than a full working view.

### Linking Back

Embedded components may provide links to open the full Metrics Drilldown experience when users need more advanced filtering or analysis capabilities.
