# The Grafana Metrics Drilldown app

The Grafana Metrics Drilldown app is a plugin for Grafana that allows users to explore metrics data in a simplified, queryless way. It is designed to be used by technical and less-technical users alike who want to understand their metrics data without the burden of authoring complex PromQL queries.

## Core Features

- **Visualizations**: Whatever the metric type, the app will automatically select the most appropriate visualization.
- **Drilldown**: After selecting a metric, users can drill down into the metric's labels to understand the metric in more detail.
- **Related signals**: After selecting a metric, users can see related metrics and logs.
- **Refinement**: With tools like label filters, metric name search, and a suite of advanced filters in the sidebar (like prefix filters, suffix filters, and group by labels), users can reduce the "sea of metrics" to a manageable set of metrics panels, to more easily hone in on the metrics they are interested in.

## Core Principles

- **Simplicity**: The app is designed to be simple and easy to use, while offering progressive disclosure of complexity and advanced features to users who require them.
- **General purpose**: Although the app is very capable in an Observability context, it is designed to be general purpose and can be used for any Prometheus-compatible metrics data source.
- **Accessible**: The app is designed to be accessible to all users, and to be able to be used by users with varying levels of technical expertise.
- **Connectivity**: The app does not exist in a silo. Users can navigate to Metrics Drilldown from a variety of different places in Grafana, and they can engage with other Grafana apps and features from within Metrics Drilldown.
