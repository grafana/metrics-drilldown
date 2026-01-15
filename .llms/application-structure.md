# Application Structure

The typical Metrics Drilldown app user flow is as follows:

1. User navigates to the Metrics Drilldown app, which shows the "Metrics Reducer" scene. This scene is responsible for listing and refining the metrics that are available in the data source.
2. User selects a data source, if the correct data source is not already selected.
3. User selects a metric, which triggers the "MetricScene" scene. This scene is responsible for displaying the metric's visualization and related information. The MetricScene has three tabs: "Breakdown", "Related Metrics", and "Related Logs" with their own respective scenes. The main metric panel is a "GmdVizPanel" scene, which is responsible for displaying the metric's visualization.
4. The "Breakdown" tab shows a breakdown of the metric's labels, which triggers the "LabelBreakdown" scene.
5. The "Related Metrics" tab shows related metrics, which triggers the "RelatedMetrics" scene.
6. The "Related Logs" tab shows related logs, which triggers the "RelatedLogs" scene.

## Metrics Reducer Scene

### Sidebar

## Metric Scene

### GmdVizPanel

The GmdVizPanel offers a variety of actions for the metric, including:

- "Configure": Opens the metric's function configuration panel, which allows the user to select different PromQL functions to apply to the metric.
- "Open Assistant": Opens the metric's assistant, which allows the user to ask questions about the metric. This action is only available if the Grafana Assistant is available.
- "Add to Dashboard": Adds the metric to a new or existing dashboard.
- "Bookmark": Adds the metric to the user's Metrics Drilldown bookmarks, which are available in the sidebar.
