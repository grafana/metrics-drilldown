---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Get started with Grafana Metrics Drilldown
menuTitle: Get started
weight: 20
refs:
  drilldown:
    - pattern: /docs/grafana/
      destination: https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/metrics/drill-down-metrics/
    - pattern: /docs/grafana-cloud/
      destination: https://grafana.com/docs/grafana-cloud/visualizations/simplified-exploration/metrics/drill-down-metrics/
---

# Get started with Grafana Metrics Drilldown

Use Grafana Metrics Drilldown to explore your metrics without writing a PromQL query. You can access the Grafana Metrics Drilldown app in Grafana Cloud or in self-mananged Grafana.

## Before you begin

The Grafana Metrics Drilldown app is installed in both Grafana Cloud and self-managed Grafana by default.

To use Grafana Metrics Drilldown with Grafana Cloud, you need:

- A Grafana Cloud account
- A Grafana stack in Grafana Cloud with a configured Prometheus-compatible metrics data source

To use Grafana Metrics Drilldown with Grafana open source or Grafana Enterprise, you need:

- Your own Grafana instance running Grafana version 11.6 or later
- A configured Prometheus-compatible metrics data source

## Access Grafana Metrics Drilldown

Access the Grafana Metrics Drilldown app either through the main page in Grafana or through a dashboard.

### Access the app through the Grafana main page

Follow these steps to access the app through the Grafana main page.

1. From the Grafana left-side menu, select **Drilldown**.

   The **Drilldown** page opens.
1. From the list of Drilldown apps, select **Metrics**.

   The **Metrics Drilldown** overview page opens showing recent metrics, bookmarks, and the option to start a new metric exploration.
1. Select **Let's start**.

### Access the app through a dashboard

Follow these steps to access the app through an existing metrics dashboard in Grafana.

1. Navigate to your dashboard in Grafana.
1. Select a time series panel.
1. Select the panel menu, and then select **Metrics drilldown**. If there are multiple available metrics, select the one you want to explore.

A drawer appears showing your selected metric in the Metrics Drilldown app. To go to the app's main page, select **Open**.

## Next steps

Now you're ready to drill down into your metric data. For more information, refer to [Drill down your metrics](ref:drilldown).
