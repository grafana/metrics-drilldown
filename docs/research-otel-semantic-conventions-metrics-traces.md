# OpenTelemetry Semantic Conventions: Metrics-to-Traces Correlation Research

> Research compiled March 2026. Covers OTel semantic conventions v1.40.0, Prometheus 3.x, Grafana Tempo, and Grafana Mimir.

## Table of Contents

1. [Metric Label/Attribute Connections](#1-metric-labelattribute-connections)
2. [Resource Attribute Connections (via target_info)](#2-resource-attribute-connections-via-target_info)
3. [Metric Prefix/Naming Conventions That Imply Trace Counterparts](#3-metric-prefixnaming-conventions-that-imply-trace-counterparts)
4. [Exemplar-Based Connections](#4-exemplar-based-connections)
5. [Appendix: Attribute Reference Tables](#appendix-attribute-reference-tables)

---

## 1. Metric Label/Attribute Connections

These are attributes that appear as **labels on Prometheus/Mimir metrics** AND as **span or resource attributes on Tempo traces**, using the same semantic meaning. They are the primary mechanism for correlating metrics with traces without exemplars.

### 1.1 HTTP Attributes (Stable since v1.23.0)

HTTP semantic conventions are the most mature, declared stable in November 2023.

| OTel Attribute | Prometheus Label | Tempo Span Attribute | Description |
|---|---|---|---|
| `http.request.method` | `http_request_method` | `span.http.request.method` | HTTP method (GET, POST, etc.). Limited to 9 common methods + `_OTHER` to control cardinality. |
| `http.response.status_code` | `http_response_status_code` | `span.http.response.status_code` | HTTP response status code (200, 404, 500, etc.) |
| `http.route` | `http_route` | `span.http.route` | The matched route template (e.g., `/users/{id}`). Available on server spans/metrics only. |
| `url.scheme` | `url_scheme` | `span.url.scheme` | URL scheme (http, https) |
| `server.address` | `server_address` | `span.server.address` | Server hostname or IP. Opt-In on metrics to prevent cardinality explosion. |
| `server.port` | `server_port` | `span.server.port` | Server port number. Opt-In on metrics. |
| `network.protocol.version` | `network_protocol_version` | `span.network.protocol.version` | HTTP version (1.1, 2, 3) |
| `error.type` | `error_type` | `span.error.type` | Error class description when operation fails |

**Legacy attributes (pre-stable, still common in the wild):**

| Legacy Attribute | Stable Replacement |
|---|---|
| `http.method` | `http.request.method` |
| `http.status_code` | `http.response.status_code` |
| `http.url` | `url.full` |
| `http.target` | `url.path` + `url.query` |
| `net.host.name` | `server.address` |
| `net.host.port` | `server.port` |
| `net.peer.name` | `server.address` (client spans) |

**How it appears in Prometheus/Mimir:**
```
http_server_request_duration_seconds_bucket{
  http_request_method="GET",
  http_response_status_code="200",
  http_route="/api/users/{id}",
  url_scheme="https",
  le="0.5"
} 1234
```

**How it appears in Tempo (TraceQL):**
```
{ span.http.request.method = "GET" && span.http.response.status_code = 200 && span.http.route = "/api/users/{id}" }
```

**Correlation strategy:** Given a metric spike on `http_server_request_duration_seconds` with label `http_route="/api/users/{id}"`, you can query Tempo for traces matching `{ span.http.route = "/api/users/{id}" && span:duration > 1s }` in the same time window.

### 1.2 Database Attributes (Mixed stability)

| OTel Attribute | Prometheus Label | Tempo Span Attribute | Description |
|---|---|---|---|
| `db.system` | `db_system` | `span.db.system` | Database system identifier (postgresql, mysql, mongodb, redis, etc.) |
| `db.operation.name` | `db_operation_name` | `span.db.operation.name` | Operation or command name (SELECT, INSERT, EXECUTE, etc.) |
| `db.collection.name` | `db_collection_name` | `span.db.collection.name` | Table, collection, or container name |
| `db.namespace` | `db_namespace` | `span.db.namespace` | Database name |
| `db.response.status_code` | `db_response_status_code` | `span.db.response.status_code` | Database-specific response/error code |
| `error.type` | `error_type` | `span.error.type` | Error class description |

**Additional trace-only attributes (too high cardinality for metrics):**

| OTel Attribute | Tempo Span Attribute | Description |
|---|---|---|
| `db.query.text` | `span.db.query.text` | Full SQL query text |
| `db.query.summary` | `span.db.query.summary` | Low-cardinality query summary |

**Trace span naming convention:** `{db.operation.name} {db.collection.name}` (e.g., `SELECT users`)

**Correlation strategy:** A spike in `db_client_operation_duration_seconds{db_system="postgresql", db_operation_name="SELECT"}` can be correlated with traces via `{ span.db.system = "postgresql" && span.db.operation.name = "SELECT" }`.

### 1.3 RPC/gRPC Attributes (Mixed stability)

| OTel Attribute | Prometheus Label | Tempo Span Attribute | Description |
|---|---|---|---|
| `rpc.system.name` | `rpc_system_name` | `span.rpc.system.name` | RPC system (grpc, dubbo, connectrpc) |
| `rpc.method` | `rpc_method` | `span.rpc.method` | Fully-qualified method name (e.g., `com.example.ExampleService/exampleMethod`) |
| `rpc.grpc.status_code` | `rpc_grpc_status_code` | `span.rpc.grpc.status_code` | gRPC numeric status code (0=OK, 1=CANCELLED, etc.) |
| `error.type` | `error_type` | `span.error.type` | Error class description |

**Legacy attributes (recently migrated):**

| Legacy Attribute | Notes |
|---|---|
| `rpc.service` | Merged into `rpc.method` as fully-qualified name |

**Correlation strategy:** A spike in `rpc_server_call_duration_seconds{rpc_method="UserService/GetUser"}` maps to traces via `{ span.rpc.method = "UserService/GetUser" }`.

### 1.4 Messaging Attributes (Development status)

| OTel Attribute | Prometheus Label | Tempo Span Attribute | Description |
|---|---|---|---|
| `messaging.system` | `messaging_system` | `span.messaging.system` | Messaging system (kafka, rabbitmq, aws_sqs, etc.) |
| `messaging.operation.name` | `messaging_operation_name` | `span.messaging.operation.name` | Operation name (send, receive, ack) |
| `messaging.operation.type` | `messaging_operation_type` | `span.messaging.operation.type` | Operation type (publish, create, receive) |
| `messaging.destination.name` | `messaging_destination_name` | `span.messaging.destination.name` | Topic or queue name |

---

## 2. Resource Attribute Connections (via target_info)

Resource attributes describe the **entity producing telemetry** (service, pod, node, etc.) rather than individual operations. They are the most powerful cross-signal correlation mechanism because they are shared identically across metrics, traces, and logs from the same source.

### 2.1 How Resource Attributes Appear in Each System

#### In Prometheus/Mimir

Resource attributes are stored in a special **`target_info`** gauge metric with value `1`. Each unique combination of `job` + `instance` (the identifying labels) gets one `target_info` series with all resource attributes as additional labels:

```
target_info{
  job="frontend",
  instance="frontend-abc123:8080",
  service_name="frontend",
  service_namespace="production",
  service_version="1.2.3",
  service_instance_id="frontend-abc123",
  deployment_environment_name="production",
  k8s_namespace_name="default",
  k8s_pod_name="frontend-abc123",
  k8s_deployment_name="frontend",
  k8s_cluster_name="us-east-1",
  telemetry_sdk_language="go",
  telemetry_sdk_version="1.24.0"
} 1
```

Some high-value resource attributes can be **promoted** to appear directly as labels on every metric (avoiding the need for joins):
- Mimir: `-distributor.promote-otel-resource-attributes` flag
- Prometheus OTLP config: `promote_resource_attributes` setting
- By default, `service.name`, `service.namespace`, and `service.instance.id` are typically promoted

#### In Tempo Traces

Resource attributes appear at the **resource scope** of each trace span and are queryable via the `resource.` prefix in TraceQL:

```
{ resource.service.name = "frontend" && resource.k8s.namespace.name = "default" }
```

Note the difference in separator: Prometheus uses underscores (`service_name`), while Tempo preserves dots (`service.name`).

### 2.2 Key Resource Attributes for Correlation

| OTel Resource Attribute | Prometheus (target_info label) | Tempo (TraceQL) | Correlation Value |
|---|---|---|---|
| `service.name` | `service_name` | `resource.service.name` | **Primary correlation key.** Identifies which service produced both the metric and the trace. |
| `service.namespace` | `service_namespace` | `resource.service.namespace` | Disambiguates services with the same name across namespaces. |
| `service.instance.id` | `service_instance_id` | `resource.service.instance.id` | Identifies the specific instance (pod, process) for precise correlation. |
| `service.version` | `service_version` | `resource.service.version` | Version correlation for canary/blue-green deployments. |
| `deployment.environment.name` | `deployment_environment_name` | `resource.deployment.environment.name` | Environment (production, staging, dev). |
| `k8s.namespace.name` | `k8s_namespace_name` | `resource.k8s.namespace.name` | Kubernetes namespace. |
| `k8s.pod.name` | `k8s_pod_name` | `resource.k8s.pod.name` | Kubernetes pod name. |
| `k8s.deployment.name` | `k8s_deployment_name` | `resource.k8s.deployment.name` | Kubernetes deployment name. |
| `k8s.cluster.name` | `k8s_cluster_name` | `resource.k8s.cluster.name` | Kubernetes cluster name. |
| `k8s.node.name` | `k8s_node_name` | `resource.k8s.node.name` | Kubernetes node name. |
| `k8s.container.name` | `k8s_container_name` | `resource.k8s.container.name` | Container name. |
| `cloud.region` | `cloud_region` | `resource.cloud.region` | Cloud region. |
| `cloud.availability_zone` | `cloud_availability_zone` | `resource.cloud.availability_zone` | Cloud AZ. |

### 2.3 PromQL Patterns for Accessing Resource Attributes

**Traditional join with target_info:**
```promql
sum by (http_route, k8s_namespace_name) (
    rate(http_server_request_duration_seconds_count[5m])
  * on (job, instance) group_left (k8s_namespace_name)
    target_info
)
```

**Prometheus 3.x experimental info() function:**
```promql
sum by (k8s_namespace_name, http_route) (
  info(
    rate(http_server_request_duration_seconds_count[5m]),
    {k8s_namespace_name=~".+"}
  )
)
```

**Correlation flow:**
1. Query Prometheus for `http_server_request_duration_seconds` with label filters
2. Join with `target_info` to resolve `service_name`, `k8s_namespace_name`, etc.
3. Use those resolved values to query Tempo: `{ resource.service.name = "frontend" && resource.k8s.namespace.name = "default" }`

---

## 3. Metric Prefix/Naming Conventions That Imply Trace Counterparts

OTel metric names follow a hierarchical `{component}.{role}.{metric_name}` convention. Each metric prefix corresponds to a category of trace spans with shared attributes.

### 3.1 Metric-to-Trace Mapping Table

| Metric Prefix | Example Metrics | Corresponding Trace Span Kind | Trace Span Name Pattern | Shared Attributes |
|---|---|---|---|---|
| `http.server.*` | `http.server.request.duration`, `http.server.active_requests`, `http.server.request.body.size` | `SpanKind.SERVER` | `{http.request.method} {http.route}` | `http.request.method`, `http.response.status_code`, `http.route`, `url.scheme` |
| `http.client.*` | `http.client.request.duration`, `http.client.connection.duration`, `http.client.active_requests` | `SpanKind.CLIENT` | `{http.request.method}` | `http.request.method`, `http.response.status_code`, `server.address`, `server.port` |
| `db.client.*` | `db.client.operation.duration` | `SpanKind.CLIENT` | `{db.operation.name} {db.collection.name}` | `db.system`, `db.operation.name`, `db.collection.name`, `db.namespace` |
| `rpc.server.*` | `rpc.server.call.duration`, `rpc.server.request.size`, `rpc.server.response.size` | `SpanKind.SERVER` | `{rpc.method}` | `rpc.system.name`, `rpc.method`, `rpc.grpc.status_code` |
| `rpc.client.*` | `rpc.client.call.duration`, `rpc.client.request.size`, `rpc.client.response.size` | `SpanKind.CLIENT` | `{rpc.method}` | `rpc.system.name`, `rpc.method`, `rpc.grpc.status_code` |
| `messaging.client.*` | `messaging.client.operation.duration`, `messaging.client.published.messages`, `messaging.client.consumed.messages` | `SpanKind.PRODUCER` or `SpanKind.CONSUMER` | `{messaging.destination.name} {messaging.operation.type}` | `messaging.system`, `messaging.operation.name`, `messaging.destination.name` |

### 3.2 Prometheus Name Translation

OTel metric names undergo transformation when stored in Prometheus:

| Transformation | OTel Name | Prometheus Name |
|---|---|---|
| Dots → underscores | `http.server.request.duration` | `http_server_request_duration` |
| Unit suffix added | (unit: `s`) | `http_server_request_duration_seconds` |
| Counter suffix | (type: counter) | `http_server_request_duration_seconds_total` |
| Histogram suffixes | (type: histogram) | `http_server_request_duration_seconds_bucket`, `_count`, `_sum` |

**Full example mapping:**

| OTel Metric | Prometheus Metric |
|---|---|
| `http.server.request.duration` (histogram, seconds) | `http_server_request_duration_seconds_bucket` / `_count` / `_sum` |
| `http.server.active_requests` (updowncounter) | `http_server_active_requests` |
| `http.client.request.duration` (histogram, seconds) | `http_client_request_duration_seconds_bucket` / `_count` / `_sum` |
| `db.client.operation.duration` (histogram, seconds) | `db_client_operation_duration_seconds_bucket` / `_count` / `_sum` |
| `rpc.server.call.duration` (histogram, seconds) | `rpc_server_call_duration_seconds_bucket` / `_count` / `_sum` |
| `rpc.client.call.duration` (histogram, seconds) | `rpc_client_call_duration_seconds_bucket` / `_count` / `_sum` |
| `messaging.client.operation.duration` (histogram, seconds) | `messaging_client_operation_duration_seconds_bucket` / `_count` / `_sum` |

### 3.3 Reverse Mapping: Prometheus Name → Trace Category

Given a Prometheus metric name, you can infer what kind of traces to look for:

| Prometheus Metric Prefix | Look for Traces With |
|---|---|
| `http_server_*` | Server spans with `span.http.route`, `span.http.request.method` |
| `http_client_*` | Client spans calling external HTTP services |
| `db_client_*` | Client spans for database operations with `span.db.system` |
| `rpc_server_*` | Server spans handling RPC calls with `span.rpc.method` |
| `rpc_client_*` | Client spans making RPC calls |
| `messaging_client_*` | Producer/consumer spans with `span.messaging.system` |

---

## 4. Exemplar-Based Connections

Exemplars provide the most direct link between metrics and traces: a specific `trace_id` (and optionally `span_id`) embedded directly in a metric data point.

### 4.1 How Exemplars Work

When an application records a metric measurement (e.g., observing a histogram value for request duration), the OTel SDK automatically captures the `trace_id` and `span_id` from the active span context and attaches them as exemplar metadata. This creates a direct pointer from an aggregated metric data point to the specific trace that contributed to it.

**SDK exemplar flow:**
1. Application records a metric measurement (e.g., histogram observation)
2. SDK checks for active sampled span in current context
3. If present, captures `trace_id` + `span_id` via reservoir sampling
4. Exemplar is attached to the metric data point and exported

### 4.2 Exemplar Configuration

**Exemplar filter options (via `OTEL_METRICS_EXEMPLAR_FILTER`):**

| Filter | Behavior | Use Case |
|---|---|---|
| `trace_based` (recommended) | Only attach exemplars when there is an active sampled trace | Production — ensures the linked trace exists in the backend |
| `always_on` | Attach exemplars on every measurement | Development/debugging |
| `always_off` | Never attach exemplars | Disable feature |

### 4.3 How Exemplars Appear in Prometheus/Mimir

Exemplars are stored alongside histogram and counter metrics in OpenMetrics format:

```
# TYPE http_server_request_duration_seconds histogram
http_server_request_duration_seconds_bucket{http_route="/api/users/{id}",le="0.5"} 1234 # {trace_id="abc123def456",span_id="789ghi"} 0.47 1679529600.000
```

**Requirements:**
- Prometheus 2.26+ with `--enable-feature=exemplar-storage`
- Mimir: exemplar storage enabled by default
- Grafana 7.4+ for exemplar visualization

**Querying exemplars in Prometheus:**
The `/api/v1/query_exemplars` API endpoint returns exemplars for a given PromQL expression within a time range.

### 4.4 How Exemplar-Linked Traces Appear in Tempo

When a user clicks an exemplar dot on a Grafana time series panel:
1. Grafana extracts the `trace_id` (and optionally `span_id`) from the exemplar labels
2. Grafana navigates to the configured Tempo data source
3. Tempo retrieves the full trace by trace ID
4. If `span_id` is present, the trace view auto-focuses on that specific span

**TraceQL equivalent:** `{ trace:id = "abc123def456" }`

### 4.5 Tempo Metrics-Generator: Automatic Exemplar Bridging

Tempo's **metrics-generator** component creates a powerful automatic bridge between traces and metrics:

**Architecture:**
1. Distributor receives spans and routes them to both Ingester (trace storage) and metrics-generator
2. Metrics-generator processes spans and derives RED metrics with exemplars automatically attached
3. Derived metrics are pushed to Prometheus/Mimir via remote write

**Generated metrics:**
- **Span metrics:** `traces_spanmetrics_duration_seconds_bucket` (histogram), `traces_spanmetrics_calls_total` (counter) — with dimensions: `service`, `span_name`, `span_kind`, `status_code`, and configurable additional span attributes
- **Service graph metrics:** `traces_service_graph_request_total`, `traces_service_graph_request_failed_total`, `traces_service_graph_request_server_seconds_bucket` — representing edges between services

Since the metrics-generator has access to the original spans, it automatically embeds exemplar `trace_id` values, providing zero-configuration metrics-to-traces correlation for 100% of span data.

### 4.6 Grafana Data Source Configuration for Exemplars

In the Prometheus data source settings, an **Exemplars** section allows configuring:
- **Internal link:** Toggle to use an internal Tempo data source
- **Data source:** Select the Tempo data source for trace lookups
- **URL label:** The exemplar label containing the trace ID (typically `trace_id` or `traceID`)
- **Span ID label:** The exemplar label containing the span ID (if available)

---

## 5. Practical Correlation Strategies for a Metrics Drilldown UI

### 5.1 Strategy Matrix

| Connection Type | Cardinality | Precision | Setup Required | Best For |
|---|---|---|---|---|
| **Exemplar (trace_id)** | 1:1 | Exact trace | Exemplar storage enabled | "Show me the trace that caused this spike" |
| **Shared span attributes** | 1:many | Filtered set | None (conventions) | "Show me traces for this route/operation" |
| **Resource attributes (service.name)** | 1:many (broad) | Service-scoped | target_info or promoted attrs | "Show me all traces from this service" |
| **Resource + span attributes** | 1:many (narrow) | Precise filter | Both of above | "Show me traces for this route on this service" |
| **Metric prefix inference** | 1:category | Category-scoped | None (naming convention) | "This is an HTTP metric, look for HTTP spans" |

### 5.2 Recommended Navigation Patterns

**From a metric panel to traces:**

1. **Exemplar click** (most direct): User clicks an exemplar dot → navigate to Tempo with `trace_id`
2. **Label-based drill** (filtered): Extract metric labels (`http_route`, `db_system`, `rpc_method`, etc.), map to span attributes, construct TraceQL query
3. **Service-scoped browse** (broadest): Extract `service_name` from promoted label or target_info join, navigate to Tempo filtered by `resource.service.name`

**Constructing a TraceQL query from metric context:**

Given metric: `http_server_request_duration_seconds_bucket{service_name="frontend", http_route="/api/users/{id}", http_request_method="GET"}`

→ TraceQL: `{ resource.service.name = "frontend" && span.http.route = "/api/users/{id}" && span.http.request.method = "GET" && span:kind = server }`

### 5.3 Label Name Translation Rules

When mapping between Prometheus metric labels and Tempo span attributes:

| Direction | Rule | Example |
|---|---|---|
| Prometheus → OTel attribute | Replace `_` with `.` | `http_request_method` → `http.request.method` |
| OTel attribute → Prometheus | Replace `.` with `_` | `http.request.method` → `http_request_method` |
| Prometheus label → TraceQL span attr | `label` → `span.{label with . instead of _}` | `http_route` → `span.http.route` |
| Prometheus label → TraceQL resource attr | `label` → `resource.{label with . instead of _}` | `service_name` → `resource.service.name` |

**Caveats:**
- Not all underscores map to dots (e.g., `status_code` → `status_code`, not `status.code`; but `http_response_status_code` → `http.response.status_code`)
- The mapping is defined by the OTel semantic conventions, not by a simple string replacement rule
- A reliable implementation should use a lookup table of known semantic convention attributes

---

## Appendix: Attribute Reference Tables

### A. Complete HTTP Shared Attributes

| Attribute | On Metrics | On Traces | Cardinality | Notes |
|---|---|---|---|---|
| `http.request.method` | Required | Required | Low (9 + `_OTHER`) | |
| `http.response.status_code` | Required | Required | Low (~50 common codes) | |
| `http.route` | Conditionally Required (server) | Conditionally Required (server) | Medium | Template, not actual path |
| `url.scheme` | Required | Required | Very Low (http/https) | |
| `error.type` | Conditionally Required | Conditionally Required | Low | |
| `network.protocol.version` | Recommended | Recommended | Very Low | |
| `server.address` | Opt-In (metrics) | Recommended (traces) | High | Suppressed on metrics by default |
| `server.port` | Opt-In (metrics) | Recommended (traces) | Low-Medium | Suppressed on metrics by default |

### B. Complete Database Shared Attributes

| Attribute | On Metrics | On Traces | Cardinality | Notes |
|---|---|---|---|---|
| `db.system` | Required | Required | Very Low | |
| `db.operation.name` | Conditionally Required | Conditionally Required | Low-Medium | |
| `db.collection.name` | Recommended | Recommended | Medium | |
| `db.namespace` | Conditionally Required | Conditionally Required | Low | |
| `db.response.status_code` | Conditionally Required | Conditionally Required | Low | |
| `error.type` | Conditionally Required | Conditionally Required | Low | |
| `server.address` | Recommended | Recommended | Medium | |
| `server.port` | Conditionally Required | Conditionally Required | Low | |
| `db.query.text` | **Not on metrics** | Opt-In (traces) | Very High | Too high cardinality for metrics |

### C. Complete RPC Shared Attributes

| Attribute | On Metrics | On Traces | Cardinality | Notes |
|---|---|---|---|---|
| `rpc.system.name` | Required | Required | Very Low | |
| `rpc.method` | Conditionally Required | Conditionally Required | Medium | Fully-qualified method name |
| `rpc.grpc.status_code` | Conditionally Required | Conditionally Required | Very Low (0-16) | gRPC only |
| `error.type` | Conditionally Required | Conditionally Required | Low | |
| `server.address` | Recommended | Recommended | Medium | |
| `server.port` | Recommended | Recommended | Low | |

### D. Resource Attributes Commonly Available for Correlation

| Attribute | Typical Source | Prometheus Storage | Tempo Storage |
|---|---|---|---|
| `service.name` | SDK / K8s annotations | Promoted label or `target_info` | `resource.service.name` |
| `service.namespace` | SDK / K8s annotations | Promoted label or `target_info` | `resource.service.namespace` |
| `service.instance.id` | SDK / K8s annotations | Promoted label or `target_info` | `resource.service.instance.id` |
| `service.version` | SDK / env var | `target_info` | `resource.service.version` |
| `deployment.environment.name` | SDK / env var | `target_info` or promoted | `resource.deployment.environment.name` |
| `k8s.namespace.name` | K8s attributes processor | `target_info` or promoted | `resource.k8s.namespace.name` |
| `k8s.pod.name` | K8s attributes processor | `target_info` or promoted | `resource.k8s.pod.name` |
| `k8s.deployment.name` | K8s attributes processor | `target_info` or promoted | `resource.k8s.deployment.name` |
| `k8s.cluster.name` | K8s attributes processor | `target_info` or promoted | `resource.k8s.cluster.name` |
| `k8s.node.name` | K8s attributes processor | `target_info` | `resource.k8s.node.name` |
| `k8s.container.name` | K8s attributes processor | `target_info` | `resource.k8s.container.name` |
| `cloud.region` | SDK / cloud metadata | `target_info` or promoted | `resource.cloud.region` |
| `cloud.availability_zone` | SDK / cloud metadata | `target_info` or promoted | `resource.cloud.availability_zone` |
| `host.name` | SDK / OS metadata | `target_info` | `resource.host.name` |

### E. Tempo Metrics-Generator Output Metrics

These Prometheus metrics are auto-generated from trace data and inherently correlate with traces:

| Metric | Type | Labels | Correlation |
|---|---|---|---|
| `traces_spanmetrics_duration_seconds` | Histogram | `service`, `span_name`, `span_kind`, `status_code`, + configured dimensions | Direct: same data as traces, exemplars included |
| `traces_spanmetrics_calls_total` | Counter | Same as above | Direct: count of spans |
| `traces_service_graph_request_total` | Counter | `client`, `server`, `connection_type` | Edges between services |
| `traces_service_graph_request_failed_total` | Counter | Same as above | Failed edges |
| `traces_service_graph_request_server_seconds` | Histogram | Same as above | Latency between services |
