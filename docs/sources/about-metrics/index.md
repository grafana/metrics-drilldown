---
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Metrics and telemetry
weight: 10
---

# About metrics and telemetry

Metrics, logs, traces, and profiles form the pillars of observability.
Correlating between the four pillars of observability helps create a holistic view of your application and infrastructure.

![The four pillars of observability](../images/four-pillars-observe.png)

## Metrics

Metrics provide a high-level picture of the state of a system. Metrics are the foundation of alerts because metrics are numeric values and can be compared against known thresholds. Alerts constantly run in the background and trigger when a value is outside of an expected range. This is typically the first sign that something is going on and are where discovery first starts. Metrics indicate that something is happening.

## Logs

Logs provide an audit trail of activity from a single process that create informational context. Logs act as atomic events, detailing what's occurring in the services in your application. Whereas metrics are quantitative (numeric) and structured, logs are qualitative (textual) and unstructured or semi-structured. They offer a higher degree of detail, but also at the expense of creating significantly higher data volumes.
Logs let you know what's happening to your application.

## Traces

Traces add further to the observability picture by telling you what happens at each step or action in a data pathway. Traces provide the map, the where, something is going wrong. A trace provides a graphic representation of how long each step in the data flow pathway takes to complete. For example, how long a HTTP request, a database lookup, or a call to a third party service takes. It can show where requests initiate and finish, as well as how your system responds. This data helps you locate problem areas and assess their impact, often in places you never would have anticipated or found without this ability to trace the request flow.

## Profiles

Profiles help you understand how your applications utilize compute resources such as CPU time and memory. This helps identify specific lines of code or functions to optimize and improve performance and efficiency.

## Why use metrics?

Metrics tell you how much of something exists, such as how much memory a computer system has available or how many centimeters long a desktop is. In the case of Grafana, metrics are most useful when they are recorded repeatedly over time. This permits us to compare things like how running a program affects the availability of system resources, as shown in the following dashboard.

![Sample visualization dashboard](../images/visualization_sample.png)

Metrics like these are stored in a time series database (TSDB), like [Prometheus](https://prometheus.io/), by recording a metric and pairing that entry with a time stamp. Each TSDB uses a slightly different [data model](https://prometheus.io/docs/concepts/data_model/), but all combine these two aspects and Grafana and Grafana Cloud can accept their different metrics formats for visualization.

For example, you might be interested in comparing system I/O performance as the number of users increases during a morning while many users in a company come online to start their work days.

A chart showing this change of resource use across time is an example of a visualization. Comparing these time-stamped metrics over time using visualizations makes it quick and easy to see changes to a computer system, especially as events occur.

Grafana and Grafana Cloud offer a variety of visualizations to suit different use cases. See the Grafana documentation on [visualizations](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/) for more information.
