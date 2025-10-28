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

Drill down into your metrics to gain insight into your data without writing a query. First, filter the metrics surfaced by Metrics Drilldown. Then, select a metric to perform in-depth analysis.

## Filter metrics in Metrics Drilldown

To begin drilling down your data, filter the metrics that appear in Metrics Drilldown.

1. Navigate to the **Metrics Drilldown** page in Grafana. Refer to [Get started with Grafana Metrics Drilldown](ref:get-started).
1. From the **Data source** dropdown, select a data source to view related metrics. Supported data sources include Prometheus and Prometheus-compatible data sources.

     Visualizations for your selected data source appears.
1. (Optional) Select a label name from the **Filter by label values** dropdown. Then, follow the prompts to complete your filter criteria.

     {{< admonition type="note" >}}
      You can apply multiple filters to your metrics.
     {{< /admonition >}}
1. (Optional) To search for metrics, type keywords in the search bar under **Quick search metrics**.
1. (Optional) Select how you want to sort metrics in the app. You can sort metrics alphabetically, with recently selected metrics first (default), by prevalence in dashboard panel queries, or by prevalence in alerting rules.
1. Use the time picker to select a date and time range from the dropdown menu, or use an absolute time range.
1. Click the down arrow next to the **Refresh** icon to set a refresh rate from the drop-down menu. The default refresh status is **Off**.

The visualizations in the Metrics Drilldown app adjust to reflect your filters.

![show metrics drilldown main page with filters highlighted](/media/metrics-explore/metrics-drilldown-filters.png)

## Apply advanced filters

Apply advanced filters to further refine the metrics that appear in Metrics Drilldown. Access the following advanced filters from the left-side menu of the Metrics Drilldown app.

| Filter type     | Description                                                                                                       |
|-----------------|-------------------------------------------------------------------------------------------------------------------|
| Rules filters   | Filter metrics based on whether they use recording or alerting rules.                                             |
| Prefix filters   | Filter metrics based on their name prefix in the Prometheus namespace. Multiple selected prefixes use "OR" logic. |
| Suffix filters  | Filter metrics based on their name suffix. Multiple selected suffixes use "OR" logic.                             |
| Group by labels | Group metrics by their label values.                                                                              |

{{< admonition type="note" >}}
Multiple selections for a filter apply "OR" logic, but selections between filters apply "AND" logic. For example, if you select both `envoy` and `kafka` as prefix filters, the app shows all metrics with a prefix of either `envoy` or `kafka`. Then, if you select `count` as a suffix filter, the app updates to only show metrics with the `count` suffix. {{< /admonition >}}

## Analyze selected metrics

After filtering the metrics in Metrics Drilldown, you can further drill down into selected metrics.

1. From the **Metrics Drilldown** main page, locate the metric you want to drill down.
1. From the upper-right corner of the metric's dashboard panel, click **Select**, as shown in the following screenshot.

    ![show select box](/media/metrics-explore/select-metric-drilldown.png)

A detailed view of the metric opens that shows the following details:

- A **Breakdown** tab that shows time series visualizations for each of the label-value pairs for the selected metric. To add a label-value pair to your filters, you can  drill down on each label and then click **Add to filter**.
- A **Related metrics** tab that shows other metrics with similar names and common prefixes. Use it to quickly find metrics that belong to the same area or task without knowing exact metric names.

After gathering your data in the Metric Drilldown app, you can take the following next steps:

- To open the visualization in Explore, where you can modify its underlying query or add it to a dashboard or incident, click the **Open in Explore** button.
- To copy the Metric Drilldown page's URL to your clipboard, click **Copy URL**. Now, you can share it with others.
- To bookmark and save your Metric Drilldown journey, click the **Star** button.

## Troubleshoot missing metrics

Some Prometheus metrics may not appear in Metrics Drilldown, even though you can view them in Explore. This happens in high-cardinality environments when the Prometheus data source enforces its default 40,000-metric limit.

To resolve this issue, choose one of the following options:

- Increase the metric limit in your Prometheus data source settings.

  {{< admonition type="caution" >}}
  Increasing this limit can affect Metrics Drilldown performance.
  {{< /admonition >}}

- Use the name filter to focus on a specific metric. For example: `__name__ = vm_http`.

