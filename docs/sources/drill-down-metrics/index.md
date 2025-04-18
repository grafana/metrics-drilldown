---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Drill down your metrics
weight: 30
refs:
  get-started:
    - pattern: /docs/grafana/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/metrics/get-started/
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana-cloud/visualizations/simplified-exploration/metrics/get-started/
---

# Drill down your metrics

Drill down into your metrics to gain insight into your data without writing a query. First, filter the metrics surfaced by **Metrics Drilldown**. Then, select a metric to perform in-depth analysis.

## Filter the Metrics Drilldown dashboard

To begin drilling down your data, filter the metrics that appear in **Metrics Drilldown**.

1. Navigate to the **Metrics Drilldown** page in Grafana. Refer to [Get started with Grafana Metrics Drilldown](ref:get-started).
1. From the **Data source** dropdown, select a data source to view related metrics. Supported data sources include Prometheus and Prometheus-compatible data sources.

     A dashboard of metrics for your selected data source appears.
1. (Optional) Select a label name from the **Filter by label values** dropdown. Then, follow the prompts to complete your filter criteria.

     {{< admonition type="note" >}}
      You can apply multiple filters to your metrics.
     {{< /admonition >}}
1. (Optional) To search for metrics, type keywords in the search bar under **Search metrics**.
1. Use the time picker to select a date and time range from the dropdown menu, or use an absolute time range.
1. Click the down arrow next to the **Refresh** icon to set a refresh rate from the drop-down menu. The default refresh status is **Off**.

The **Metrics Drilldown** dashboard adjusts to reflect your selected filters. To review the steps in your journey, use the **History** breadcrumbs at the top of the dashboard, as shown in the following screenshot.

![show metrics explore overview](/media/metrics-explore/metrics-drilldown-overview.png)

## Analyze selected metrics

After filtering the metrics in the **Metrics Drilldown** dashboard, you can further drill down into selected metrics.

1. From the **Metrics Drilldown** dashboard, locate the metric you want to drill down.
1. From the upper-right corner of the metric's dashboard panel, click **Select**, as shown in the following screenshot.

    ![show select box](/media/metrics-explore/select-metric.png)

A detailed view of the metric opens that shows the following details:

- An overview of the metric that includes a description, as well as the metric's type and unit. You can filter by label using the **Filter by label values** dropdown.
- A **Breakdown** tab that shows time series visualizations for each of the label-value pairs for the selected metric. To add a label-value pair to your filters, you can  drill down on each label and then click **Add to filter**.
- A **Related metrics** tab that shows related metrics with relevant keywords.

After gathering your metric drilldown data, you can take the following next steps:

- To open the visualization in Explore, where you can modify its underlying query or add it to a dashboard or incident, click the **Open in Explore** button.
- To copy the metric drilldown's URL to your clipboard, click **Copy URL**. Now, you can share the URL with others.
- To bookmark and save your metric drilldown journey, click the **Star** button.

