### ✨ Description

**Related issue(s):** Part of https://github.com/grafana/metrics-drilldown/issues/1343

Adds an opt-in "Show exemplars" switch to the main metric panel. When it's on, the panel asks Prometheus for exemplars alongside the query results, so you can see which samples carry a trace reference. This PR is the Metrics Drilldown side only. It does not link an exemplar to Traces Drilldown. That is separate work across this repo, Grafana core, and Traces Drilldown, and it's tracked under the same issue.

Exemplars cost an extra request, so they are never on by default. The switch state lives in the URL as `exemplars=true`. A shared link opens with exemplars on, and every other link opens with them off.

### 📖 Summary of the changes

- **The switch** (`EnableExemplarsAction`) sits in the main panel header. PR #1501 cleared the old actions out of the header to make room for new controls, and this is a new control. It's also a persistent on/off state, unlike the one-shot menu items.
- **Where it's enabled:** counters, classic histograms, and native histograms, on the timeseries, percentiles, and heatmap views. Otherwise it's disabled. The tooltip and the accessible name explain why (unsupported metric type, or unsupported panel type).
- **The tooltip reports the outcome:** exemplars showing, none found in the time range, or the query failed. A new query run clears the previous result.
- **URL state:** `DataTrail` owns the `exemplars` param, the same way it owns `binaryQuery`. It's reset when you select another metric, so it never carries over. Bookmark identity ignores it, so toggling doesn't change which bookmark a view matches.
- **Queries:** `GmdVizPanel` takes `exemplarsEnabled` and rebuilds the whole panel when it changes. Scenes' `VizPanel` reuses cached series when the series array is unchanged, so updating the query in place would leave stale exemplar markers. The timeseries and percentiles builders attach the flag to the first emitted query only, because Prometheus issues one `query_exemplars` request per target that asks for it. The heatmap builder has a single query. All three builders skip the flag for metric types that don't support exemplars, even if the option lingers.
- **Cost:** only the main panel can send exemplar requests, and only while the switch is on.
- **Tracking:** a new `exemplars_toggle_changed` event.
- **Known limits:**
  - In embedded mode, URL values are ignored on load (existing `DataTrail` behavior), so the param only drives the standalone app.
  - Mimir and Thanos exemplar behavior is unverified.
  - Native histogram exemplars are only exposed through protobuf formats (see the evidence below), so many apps will correctly show "No exemplars found."
  - Heatmap rendering is verified on a classic histogram (see the screenshot). A native histogram heatmap has not been checked against live data.

- [x] This pull request was substantially generated with AI assistance ([GenAI policy](https://github.com/grafana/metrics-drilldown/blob/main/docs/genai.md))

### 🔎 Why these metric types (evidence)

- **Counter:** OpenMetrics 1.0 says "A MetricPoint in a Metric's Counter's Total MAY have an exemplar." ([spec](https://prometheus.io/docs/specs/om/open_metrics_spec/))
- **Classic histogram:** the same spec says "Bucket values MAY have exemplars." It defines exemplar rules only for Counter, Histogram, and GaugeHistogram, and none for gauges, summaries, info, or state sets. That's why the switch is disabled for those.
- **Native histogram:** the Prometheus spec says "A native histogram sample can have zero, one, or more exemplars." Exemplars attach to the sample as a whole, must have a timestamp, and are exposed only through protobuf formats. ([spec](https://prometheus.io/docs/specs/native_histograms/))
- **Prometheus side:** exemplars are stored with `--enable-feature=exemplar-storage` ([feature flags](https://prometheus.io/docs/prometheus/latest/feature_flags/)) and read through `/api/v1/query_exemplars` ([HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/)).
- **Heatmap:** Grafana 9.1 added heatmap exemplar support ([release notes](https://grafana.com/docs/grafana/latest/whatsnew/whats-new-in-v9-1/)), and the heatmap docs have an Exemplars color option ([docs](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/heatmap/)). Issue [grafana/grafana#77277](https://github.com/grafana/grafana/issues/77277) reported exemplars showing on a classic-histogram heatmap but not a native one. [#77324](https://github.com/grafana/grafana/pull/77324) fixed that, and [#133258](https://github.com/grafana/grafana/pull/133258) fixed marker positioning on non-ordinal buckets.
- **Purpose:** Grafana describes exemplars as a way to "isolate problems within your data distribution by pinpointing query traces exhibiting high latency within a time interval." ([exemplars](https://grafana.com/docs/grafana/latest/fundamentals/exemplars/))

### 🧪 How to test

The local dev Prometheus has no exemplar data, so test on ops with a build of this branch. Open `<paste your edited ops link>`, then:

1. On a counter, or a histogram on the timeseries or percentiles view, turn on "Show exemplars". The URL gains `exemplars=true`, and the tooltip updates once the query returns.
2. On a histogram's default heatmap view, the switch is enabled. Turn it on and check that markers appear. The screenshot below is `assistant_http_request_duration_seconds_bucket` (a classic histogram) on ops-cortex, with markers mostly in the slowest buckets. Please also check a native histogram.
3. Reload the page, and open the URL in a new tab. The switch is on and exemplars are requested.
4. Select a different metric. The switch is off and the param is gone.
5. Turn the switch off. The param is removed and the panel rebuilds.
6. On a gauge, the switch is disabled and the tooltip explains why. Tab reaches the disabled switch. When it's enabled, it's a single tab stop.
7. Toggling exemplars doesn't change the bookmark menu item's label.

Automated coverage: `EnableExemplarsAction.test.tsx`, `GmdVizPanel.test.ts`, `DataTrail.test.tsx`, `genBookmarkKey.test.ts`, and the timeseries, percentiles, and heatmap query-builder tests.

| Location | Before | After |
|----------|--------|-------|
| Main metric panel header and heatmap (classic histogram, ops-cortex) | No exemplars switch | `<drag the screenshot here>` |
