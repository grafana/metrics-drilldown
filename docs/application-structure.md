# Application Structure

The typical Metrics Drilldown app user flow is as follows:

1. User navigates to the Metrics Drilldown app, which shows the "Metrics Reducer" scene. This scene is responsible for listing and refining the metrics that are available in the data source.
2. User selects a data source, if the correct data source is not already selected.
3. User selects a metric, which triggers the "MetricScene" scene. This scene is responsible for displaying the metric's visualization and related information. The MetricScene has three tabs: "Breakdown", "Related Metrics", and "Related Logs" with their own respective scenes. The main metric panel is a "GmdVizPanel" scene, which is responsible for displaying the metric's visualization.
4. The "Breakdown" tab shows a breakdown of the metric's labels, which triggers the "LabelBreakdown" scene.
5. The "Related Metrics" tab shows related metrics, which triggers the "RelatedMetrics" scene.
6. The "Related Logs" tab shows related logs, which triggers the "RelatedLogs" scene.

## Metrics Reducer Scene

The Metrics Reducer scene is responsible for listing and refining the metrics that are available in the data source. It is the entry point for the user to the Metrics Drilldown app. It offers controls both above the list of metric panels and in the sidebar.

### Top Controls

The top controls are located above the list of metric panels. They include:

- Data source selector: A dropdown for selecting a Prometheus-compatible data source.
- Time range selector: A time range selector for selecting the time range for the metrics.
- Auto refresh: A toggle for enabling or disabling automatic refreshing of the list of metrics by a selected time interval.
- Plugin info: A button for displaying information about the Metrics Drilldown app (including the version number) and information about the Grafana instance and data source.
- Give feedback: A button for providing feedback about the Metrics Drilldown app.
- Search: A search input for filtering the list of metrics. Users can provide a plaintext search term to filter the list of metrics by name, or a regex expression. In environments with Grafana Assistant, users can also ask Assistant a question by first typing a question mark.
- Sort by: A dropdown for sorting the list of metrics. Options include:
  - "Default": The default sorting is alphabetical with recently-selected metrics first.
  - "Alphabetical [A-Z]": The list is sorted alphabetically.
  - "Alphabetical [Z-A]": The list is sorted alphabetically in reverse order.
  - "Dashboard Usage": The list is sorted by the number of times the metric is used in dashboards, with the most used metrics first.
  - "Alerting Usage": The list is sorted by the number of times the metric is used in alerting rules, with the most used metrics first.
- Layout: A toggle for switching between grid and rows layout.
- Label filters: A dropdown for selecting a label to filter the list of metrics by. This is a powerful tool for reducing the "sea of metrics" to a manageable set of metrics.

### Sidebar

## Metric Scene

### GmdVizPanel

The GmdVizPanel offers a variety of actions for the metric, including:

- "Configure": Opens the metric's function configuration panel, which allows the user to select different PromQL functions to apply to the metric.
- "Open Assistant": Opens the metric's assistant, which allows the user to ask questions about the metric. This action is only available if the Grafana Assistant is available.
- "Add to Dashboard": Adds the metric to a new or existing dashboard.
- "Bookmark": Adds the metric to the user's Metrics Drilldown bookmarks, which are available in the sidebar.
