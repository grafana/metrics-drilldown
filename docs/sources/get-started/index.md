---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Get started with Grafana Metrics Drilldown
description: Learn how to open Grafana Metrics Drilldown from the Grafana navigation menu or from a dashboard panel so you can start exploring Prometheus-compatible metrics.
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

Use Grafana Metrics Drilldown to explore your metrics without writing a PromQL query. You can access Grafana Metrics Drilldown in Grafana Cloud or in self-managed Grafana.

## Before you begin

The Metrics Drilldown app is installed in both Grafana Cloud and self-managed Grafana by default. Make sure you have the following prerequisites for your environment:

| Requirement | Grafana Cloud                                          | Self-managed Grafana (OSS / Enterprise)                                                                                             |
| ----------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Grafana     | A Grafana Cloud account with a Grafana stack           | Your own Grafana instance running version 11.6 or later                                                                             |
| Data source | A configured Prometheus-compatible metrics data source | A configured Prometheus-compatible metrics data source, with the scrape interval set to match your metrics system's scrape interval |

## Access Metrics Drilldown

Access Metrics Drilldown either through the main page in Grafana or through a dashboard.

| From the Grafana main page                                | From a dashboard                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. From the Grafana left-side menu, select **Drilldown**. | 1. Navigate to your dashboard in Grafana.                                 |
| 2. From the list of Drilldown apps, select **Metrics**.   | 2. Select a time series panel.                                            |
|                                                           | 3. Open the panel menu, and select **Open in Grafana Metrics Drilldown**. |

{{< admonition type="note" >}}
In some Grafana versions, the dashboard menu action appears under **Metrics drilldown**.
{{< /admonition >}}

## Use metrics with other telemetry data

If you also have other telemetry data, like logs or traces, you can use the telemetry signals together.

- Refer to [Use signals together](https://grafana.com/docs/grafana-cloud/telemetry-signals/use-signals-together/) to learn about using metrics with other telemetry data and why correlation matters.
- Refer to [Telemetry signal workflows](https://grafana.com/docs/grafana-cloud/telemetry-signals/workflows/) to explore workflows across all the Drilldown apps.

## Next steps

Now you're ready to drill down into your metric data. For more information, refer to [Drill down your metrics](ref:drilldown).
