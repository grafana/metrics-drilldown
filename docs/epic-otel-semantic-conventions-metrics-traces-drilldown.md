# Epic: OTel Semantic Convention Connections Between Metrics Drilldown and Traces Drilldown

> Status: Research & Planning  
> Date: March 2026  
> Related research: [OTel Semantic Conventions Research](./research-otel-semantic-conventions-metrics-traces.md)

## Executive Summary

OpenTelemetry semantic conventions define shared attribute names, metric naming patterns, and resource attributes that appear in both Prometheus/Mimir metrics and Tempo traces. By leveraging these conventions, Metrics Drilldown can offer direct navigation to Traces Drilldown (Grafana Traces Drilldown / `grafana-tempoexplore-app`), mirroring the existing "Related Logs" → Logs Drilldown pattern.

This epic covers four distinct connection types, each with increasing depth of integration:

| # | Connection Type | Complexity | Precedent in Codebase |
|---|---|---|---|
| 1 | Shared label/attribute-based correlation | Medium | `labelsCrossReference.ts` (logs) |
| 2 | Metric prefix → trace category inference | Low-Medium | `computeMetricPrefixGroups.ts` (sidebar) |
| 3 | Resource attribute correlation via `target_info` | High | Partially in `labelsCrossReference.ts` (`job` → `service_name`) |
| 4 | Exemplar-based direct trace links | Medium | None (new pattern) |

---

## Current Architecture Context

### Existing "Related Logs" Pattern (to mirror for traces)

The codebase already connects Metrics Drilldown → Logs Drilldown via:

1. **`src/Integrations/logs/base.ts`**: Defines `MetricsLogsConnector` interface with `getDataSources()`, `getLokiQueryExpr()`, `checkConditionsMetForRelatedLogs()`
2. **`src/Integrations/logs/labelsCrossReference.ts`**: Maps Prometheus labels to Loki labels (e.g. `job` → `service_name`, `instance` → `service_instance_id`) and builds Loki queries from active filters
3. **`src/MetricScene/RelatedLogs/RelatedLogsScene.tsx`**: Scene that renders logs panel + "Open in Logs Drilldown" button
4. **`src/MetricScene/RelatedLogs/OpenInLogsDrilldownButton.tsx`**: Uses `usePluginLinks` with extension point `grafana-metricsdrilldown-app/open-in-logs-drilldown/v1` to link to `grafana-lokiexplore-app`
5. **`src/MetricScene/MetricActionBar.tsx`**: Tab bar with Breakdown, Related Metrics, Related Logs, Query Results

### Key Files That Would Need Changes or New Parallels

| Area | Existing (Logs) | New (Traces) |
|---|---|---|
| Connector interface | `Integrations/logs/base.ts` | `Integrations/traces/base.ts` |
| Label cross-reference | `Integrations/logs/labelsCrossReference.ts` | `Integrations/traces/labelsCrossReference.ts` |
| Scene | `MetricScene/RelatedLogs/RelatedLogsScene.tsx` | `MetricScene/RelatedTraces/RelatedTracesScene.tsx` |
| Open button | `MetricScene/RelatedLogs/OpenInLogsDrilldownButton.tsx` | `MetricScene/RelatedTraces/OpenInTracesDrilldownButton.tsx` |
| Orchestrator | `MetricScene/RelatedLogs/RelatedLogsOrchestrator.ts` | `MetricScene/RelatedTraces/RelatedTracesOrchestrator.ts` |
| Tab definition | `MetricActionBar.tsx` (relatedLogs entry) | `MetricActionBar.tsx` (relatedTraces entry) |
| Extension point | `plugin.json` (open-in-logs-drilldown/v1) | `plugin.json` (open-in-traces-drilldown/v1) |

---

## Sub-Issue 1: "Related Traces" Tab — Shared Label/Attribute Correlation

### Goal

Add a "Related traces" tab (next to "Related logs") that finds Tempo data sources with traces matching the current metric's label filters, using OTel semantic convention mappings.

### How It Works

When a user is viewing a metric with active label filters (e.g. `http_route="/api/users/{id}"`, `service_name="frontend"`), the system:

1. Discovers available Tempo data sources (similar to how Loki DSs are discovered for logs)
2. Maps Prometheus label names to Tempo span/resource attribute names using OTel semantic conventions
3. Builds a TraceQL query from the mapped attributes
4. Displays matching traces in a traces panel
5. Provides an "Open in Traces Drilldown" button

### Label Name Translation

The translation between Prometheus labels and Tempo TraceQL attributes requires a lookup table (not simple underscore→dot replacement, since not all underscores map to dots):

```
Prometheus Label          → TraceQL Attribute
─────────────────────────────────────────────
http_request_method       → span.http.request.method
http_response_status_code → span.http.response.status_code
http_route                → span.http.route
db_system                 → span.db.system
db_operation_name         → span.db.operation.name
rpc_method                → span.rpc.method
rpc_grpc_status_code      → span.rpc.grpc.status_code
service_name              → resource.service.name
k8s_namespace_name        → resource.k8s.namespace.name
k8s_pod_name              → resource.k8s.pod.name
job                       → resource.service.name  (Mimir convention)
instance                  → resource.service.instance.id (Mimir convention)
```

### Architecture Requirements

1. **New `MetricsTracesConnector` interface** (`src/Integrations/traces/base.ts`)
   - Mirrors `MetricsLogsConnector` but produces TraceQL instead of LogQL
   - Methods: `getDataSources()`, `getTraceQLExpr()`, `checkConditionsMetForRelatedTraces()`

2. **Semantic convention label mapping** (`src/Integrations/traces/otelAttributeMap.ts`)
   - Lookup table of known OTel semantic convention Prometheus labels → TraceQL attributes
   - Distinguish between `span.*` attributes and `resource.*` attributes
   - Handle legacy attribute names (pre-stable conventions still common in the wild)

3. **Label cross-reference connector** (`src/Integrations/traces/labelsCrossReference.ts`)
   - Similar to logs version but maps to TraceQL syntax
   - Example output: `{ resource.service.name = "frontend" && span.http.route = "/api/users/{id}" }`

4. **RelatedTracesScene** (`src/MetricScene/RelatedTraces/RelatedTracesScene.tsx`)
   - Scene that renders a traces panel (Grafana traces panel plugin)
   - Wired to a `SceneQueryRunner` with Tempo data source

5. **OpenInTracesDrilldownButton** (`src/MetricScene/RelatedTraces/OpenInTracesDrilldownButton.tsx`)
   - Uses `usePluginLinks` for extension point `grafana-metricsdrilldown-app/open-in-traces-drilldown/v1`
   - Links to `grafana-tempoexplore-app` (Traces Drilldown plugin ID, to be confirmed with Traces Drilldown team)

6. **New extension point in `plugin.json`**
   - `grafana-metricsdrilldown-app/open-in-traces-drilldown/v1`

7. **New tab in `MetricActionBar.tsx`**
   - `relatedTraces` action view alongside existing tabs

### Dependencies & Risks

- **Traces Drilldown plugin ID**: Need to confirm the actual plugin ID for Grafana Traces Drilldown (likely `grafana-tempoexplore-app` or `grafana-traces-drilldown-app`)
- **Tempo data source availability**: Not all Grafana instances will have Tempo configured; needs graceful fallback
- **TraceQL support**: Requires Tempo 2.0+ with TraceQL enabled
- **Extension point contract**: Need to coordinate with Traces Drilldown team on what context to pass (TraceQL queries, time range, etc.)

---

## Sub-Issue 2: Metric Prefix → Trace Category Inference

### Goal

When viewing a metric with an OTel-convention prefix (e.g. `http_server_*`, `db_client_*`), surface a hint or smart default that connects to the corresponding trace span category.

### How It Works

OTel metric naming conventions directly map to trace span kinds:

| Metric Prefix | Trace Span Kind | Smart Default Attributes |
|---|---|---|
| `http_server_*` | `SpanKind.SERVER` | `span.http.route`, `span.http.request.method` |
| `http_client_*` | `SpanKind.CLIENT` | `span.http.request.method`, `span.server.address` |
| `db_client_*` | `SpanKind.CLIENT` | `span.db.system`, `span.db.operation.name` |
| `rpc_server_*` | `SpanKind.SERVER` | `span.rpc.method`, `span.rpc.system.name` |
| `rpc_client_*` | `SpanKind.CLIENT` | `span.rpc.method`, `span.rpc.system.name` |
| `messaging_client_*` | `SpanKind.PRODUCER` / `CONSUMER` | `span.messaging.system`, `span.messaging.destination.name` |
| `traces_spanmetrics_*` | Any (Tempo metrics-generator) | `span_name`, `service` |

### Architecture Requirements

1. **Prefix-to-trace-category mapping** (`src/Integrations/traces/otelMetricPrefixes.ts`)
   - Map metric name prefixes to span kinds and expected attributes
   - Handle Prometheus name translation (dots→underscores, unit suffixes)

2. **Integration with existing prefix filter system**
   - `computeMetricPrefixGroups.ts` already extracts prefixes
   - Could augment prefix display to show trace-related icon or badge for OTel-convention prefixes

3. **Smart TraceQL construction**
   - When a user views `http_server_request_duration_seconds`, auto-construct: `{ span:kind = server && span.http.route != "" }`
   - Combine with label filters from Sub-Issue 1 for precise queries

4. **Traces Drilldown hint in metric panel** (optional UX enhancement)
   - Show a subtle indicator (icon, tooltip, or link) on metric panels whose names match OTel conventions
   - "This metric has corresponding traces" → click to navigate

### Dependencies & Risks

- Metric names in the wild don't always follow OTel conventions; false positive detection is a risk
- Need heuristics to distinguish OTel-convention metrics from coincidental prefix matches
- The `traces_spanmetrics_*` prefix (from Tempo metrics-generator) is a special case that deserves first-class support since these metrics are derived directly from trace data

---

## Sub-Issue 3: Resource Attribute Correlation via `target_info`

### Goal

Use OTel resource attributes stored in Prometheus's `target_info` metric to enrich trace queries with service identity, Kubernetes context, and deployment metadata.

### How It Works

1. Query `target_info{job="...", instance="..."}` to get resource attributes for the service producing the current metric
2. Extract key resource attributes: `service_name`, `k8s_namespace_name`, `k8s_pod_name`, `deployment_environment_name`, etc.
3. Map these to Tempo resource attributes: `resource.service.name`, `resource.k8s.namespace.name`, etc.
4. Use them to scope trace queries more precisely

### Example Flow

```
User views: http_server_request_duration_seconds{job="frontend", instance="frontend-abc:8080"}

Step 1: Query target_info
  target_info{job="frontend", instance="frontend-abc:8080"} 
  → service_name="frontend", k8s_namespace_name="production", k8s_pod_name="frontend-abc"

Step 2: Build enriched TraceQL
  { resource.service.name = "frontend" 
    && resource.k8s.namespace.name = "production" 
    && span:kind = server }

Step 3: Combine with span-level attributes from label filters
  { resource.service.name = "frontend" 
    && resource.k8s.namespace.name = "production" 
    && span.http.route = "/api/users/{id}" 
    && span:kind = server }
```

### Architecture Requirements

1. **`target_info` query utility** (`src/Integrations/traces/targetInfo.ts`)
   - Query Prometheus for `target_info` matching current metric's `job`/`instance` labels
   - Parse and cache resource attributes
   - Handle the case where `target_info` doesn't exist (non-OTel environments)

2. **Resource attribute → TraceQL mapping** (extension of `otelAttributeMap.ts`)
   - Map `target_info` labels to `resource.*` TraceQL attributes
   - Known mappings: `service_name` → `resource.service.name`, `k8s_namespace_name` → `resource.k8s.namespace.name`, etc.

3. **Promoted resource attributes detection**
   - Some Mimir setups promote resource attributes directly onto metrics (e.g. `service_name` appears as a direct label)
   - Detect whether attributes are promoted (direct label) vs. require `target_info` join
   - Use promoted attributes directly when available

4. **PromQL join for non-promoted attributes**
   - Build `* on (job, instance) group_left(...) target_info` joins
   - Consider using Prometheus 3.x `info()` function where available
   - This is the most complex part and may require detecting Prometheus version capabilities

5. **Integration with "Related Traces" tab**
   - Resource attributes should enrich the trace query built in Sub-Issue 1
   - Even without span-level label matches, `service.name` alone enables basic correlation

### Dependencies & Risks

- **`target_info` availability**: Only present when OTel collector is sending metrics to Prometheus/Mimir with resource attributes enabled; many environments won't have this
- **PromQL complexity**: `target_info` joins can be slow on large datasets
- **Mimir `promote-otel-resource-attributes` flag**: Behavior varies by Mimir configuration
- **This is the highest-complexity sub-issue** and should be tackled after Sub-Issues 1 and 2 are stable

---

## Sub-Issue 4: Exemplar-Based Direct Trace Navigation

### Goal

Enable users to click on exemplar data points in metric panels to navigate directly to the corresponding trace in Tempo/Traces Drilldown.

### How It Works

OTel SDKs attach `trace_id` (and optionally `span_id`) as exemplar metadata on histogram and counter observations. When these are stored in Prometheus/Mimir, exemplars appear as clickable dots on time series panels. Clicking an exemplar should navigate to the trace.

### Current State

Grafana already supports exemplar click-through to Tempo in standard dashboard panels via the Prometheus data source's Exemplars configuration. However, Metrics Drilldown uses its own `GmdVizPanel` system which may not automatically surface this functionality.

### Architecture Requirements

1. **Exemplar detection** (`src/shared/GmdVizPanel/exemplars/`)
   - Detect whether the current metric has exemplars available
   - Query `/api/v1/query_exemplars` for the current PromQL expression and time range

2. **Exemplar visualization in GmdVizPanel**
   - Enable exemplar overlay on time series panels
   - Configure the exemplar data link to point to the correct Tempo data source
   - Map `trace_id` exemplar label to Tempo trace lookup

3. **Tempo data source discovery for exemplars**
   - Detect configured Tempo data sources
   - Match Prometheus data source's exemplar configuration to find the correct Tempo DS
   - Handle both internal links and external URL configurations

4. **Click-through navigation**
   - Option A: Navigate to Grafana Explore with Tempo DS and trace ID (existing Grafana pattern)
   - Option B: Navigate to Traces Drilldown app with trace ID (new, preferred if Traces Drilldown supports it)
   - Both should be supported, with Traces Drilldown preferred when available

5. **Tempo metrics-generator awareness** (special case)
   - Metrics with prefix `traces_spanmetrics_*` are derived from traces and already have exemplars
   - These should get first-class treatment since they guarantee trace correlation

### Dependencies & Risks

- **Exemplar storage must be enabled**: Prometheus requires `--enable-feature=exemplar-storage`; Mimir has it by default
- **Not all metrics have exemplars**: Only histograms and counters from OTel-instrumented services with `trace_based` or `always_on` exemplar filters
- **GmdVizPanel customization**: The custom visualization panel may need significant changes to support exemplar overlays
- **Traces Drilldown deep link format**: Need to coordinate on how to deep-link to a specific trace ID in Traces Drilldown

---

## Implementation Ordering & Dependencies

```
Sub-Issue 1: "Related Traces" Tab (Label Correlation)
    ├── Foundation: Connector interface, Tempo DS discovery, TraceQL builder
    ├── Core: Label-to-attribute mapping, RelatedTracesScene, tab integration
    └── Polish: Open in Traces Drilldown button, extension point
        │
Sub-Issue 2: Metric Prefix → Trace Category
    ├── Can start in parallel with Sub-Issue 1
    ├── Depends on: OTel attribute map from Sub-Issue 1
    └── Enhances: TraceQL query construction from Sub-Issue 1
        │
Sub-Issue 3: Resource Attributes via target_info
    ├── Depends on: Sub-Issue 1 (enriches its trace queries)
    ├── Requires: target_info query infrastructure
    └── Most complex, do last
        │
Sub-Issue 4: Exemplar-Based Trace Links
    ├── Can start independently
    ├── Depends on: Tempo DS discovery from Sub-Issue 1
    └── Complements rather than depends on other sub-issues
```

### Recommended Order

1. **Sub-Issue 1** first — establishes the foundational infrastructure (connector interface, Tempo DS discovery, attribute mapping, tab UI)
2. **Sub-Issue 2** second — adds smart prefix-based defaults using infrastructure from Sub-Issue 1
3. **Sub-Issue 4** third — independent exemplar support that adds high-value direct trace links
4. **Sub-Issue 3** last — most complex, builds on all previous work

---

## Cross-Team Coordination Required

### With Traces Drilldown Team (Joey et al.)

- **Plugin ID confirmation**: What is the Traces Drilldown plugin ID? (`grafana-tempoexplore-app`?)
- **Extension point contract**: What context does Traces Drilldown accept for incoming links? (TraceQL query, time range, data source UID?)
- **Bidirectional links**: Should Traces Drilldown also link back to Metrics Drilldown? (Trace → "Related Metrics")
- **Shared component opportunities**: Could the OTel attribute mapping be a shared library?

### With Mimir/Prometheus Team

- **`target_info` query patterns**: Best practices for efficient `target_info` joins
- **Promoted resource attributes**: How to detect which attributes are promoted vs. require joins
- **Prometheus version detection**: How to detect if `info()` function is available

### With Tempo Team

- **TraceQL capabilities**: Confirm TraceQL syntax for span kind filtering, resource attribute queries
- **Exemplar format**: Confirm exemplar label names (`trace_id` vs `traceID`)
- **Tempo data source API**: Endpoints for trace lookup, search, and tag discovery

---

## Open Questions

1. **Traces Drilldown readiness**: Does a Traces Drilldown app exist yet, or would initial links go to Grafana Explore with Tempo data source?
2. **Feature flagging**: Should this be behind a feature flag initially? (Likely yes, similar to `drilldown.metrics.hierarchical_prefix_filtering`)
3. **Bidirectional linking**: Is there appetite for Traces Drilldown → Metrics Drilldown links as well?
4. **Non-OTel environments**: How should the UI behave when metrics don't follow OTel conventions? (Graceful degradation — hide trace-related features)
5. **Performance**: How expensive is it to discover Tempo data sources and probe for matching traces? (Should it be a background task like Related Logs?)
6. **Legacy attribute support**: How far back should we support pre-stable OTel attribute names? (Common in the wild: `http.method` vs `http.request.method`)

---

## Success Criteria

- Users viewing an OTel-convention metric with label filters can navigate to related traces in one click
- The "Related Traces" tab shows a count of matching traces (background task, like Related Logs)
- Exemplar dots on metric panels link directly to traces in Tempo
- The system gracefully degrades when Tempo is not available or metrics don't follow OTel conventions
- The OTel attribute mapping is maintainable and extensible as new semantic conventions stabilize
