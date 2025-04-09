---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Drill down your metrics
weight: 30
---

# Drill down your metrics

Drill down into your metrics to gain insight into your data without writing a query.

1. Navigate to the **Metrics Drilldown** page in Grafana.
1. From the **Data source** menu, select a data source to view associated metrics. Supported data sources include Prometheus and Prometheus-compatible data sources.

1. TODO: Click **+ Add label** to select a label-value pair from the drop-down menu. You can add multiple label-value pairs. A label type appears above the selected label with a drop-down list of options from which to choose. For example, if you select the label `container` a drop-down list of available containers appears.
1. You can also search for metrics using keywords under **Search metrics** in the search bar.
1. Use the time picker to select a date and time range from the drop-down menu or use an absolute time range.
1. Click the down arrow next to the **Refresh** icon to set a refresh rate from the drop-down menu. The default is `Off`.

The **History** button in the upper left corner tracks every step navigating through metric exploration.

![show metrics explore overview](/media/metrics-explore/metrics-drilldown-overview.png)

### Metrics exploration

To further explore a metric, click **Select** in the upper right corner of the metric visualization.

![show select box](/media/metrics-explore/select-metric.png)

- The **Overview** tab provides a description for each metric, as well as the metric `type` and `unit` associated with the metric. It also provides a list of labels associated with the metric. Click on any label to view drill-down visualizations.
- The **Breakdown** tab depicts time series visualizations for each of the label-value pairs for the selected metric. You can further drill down on each label and click **Add to filter** to add the label/value pair into your filters. You can also change the **View** from grid to rows.
- The **Related metrics** tab depicts related metrics with relevant key words. You can repeat the drill down process for any related metric. Toggle **Show previews** to preview visualizations.

After you have gathered your metrics exploration data you can:

- Click the **Open in Explore** icon on the right side to open the graph in Explore, where you can modify the query or add the graph to a dashboard or incident.
- Click the **Copy URL** icon on the right side to copy the metric drill down URL to the clipboard so it can be shared.
- Click the **Star** icon on the right side to bookmark and save the metrics exploration.

