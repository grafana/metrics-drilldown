// OpenTelemetry resource attributes, most-important-first. A resource attribute describes the entity
// that PRODUCED a piece of telemetry (which service, pod, cloud region, etc.), not the metric-point
// itself, but Grafana/Mimir's OTLP ingestion and Alloy's Prometheus exporters promote these onto a
// metric's own label set by default, so a histogram can carry them as real, filterable labels
// alongside its own semantic-convention attributes (see histogramAttributes.ts). Checked
// independently of histogram domain detection: a metric can have resource attributes promoted onto it
// regardless of whether its own attributes match any known domain shape, or match none at all.
//
// Ordered by the OTel spec's own service-identity requirements first: service.name, service.instance.id,
// and service.namespace are the only three attributes that form the spec's verified uniqueness triplet
// ("service.namespace,service.name,service.instance.id MUST be globally unique"), confirmed directly
// against the resource/service spec rather than assumed; deployment.environment.name is explicitly
// excluded from that triplet by the spec itself, it's a slicing dimension, not part of identity, which
// is why it's ranked just after rather than inside the identity group. The rest are ordered by how
// consistently they're actually populated by auto-instrumentation in practice, not by formal stability
// level alone: cloud.* and host.* are spec'd Development (confirmed exhaustively against the raw
// registry YAML, not sampled) but are near-ubiquitous in real telemetry, well ahead of
// telemetry.sdk.*, which is genuine provenance (which SDK emitted this) rather than service identity.
export const RESOURCE_ATTRIBUTES: string[] = [
  'service.name',
  'service.instance.id',
  'service.namespace',
  'deployment.environment.name',
  'service.version',
  'k8s.namespace.name',
  'k8s.pod.name',
  'k8s.deployment.name',
  'k8s.cluster.name',
  'k8s.node.name',
  'cloud.provider',
  'cloud.region',
  'cloud.platform',
  'cloud.account.id',
  'cloud.availability_zone',
  'container.id',
  'container.image.name',
  'container.image.tags',
  'container.name',
  'host.name',
  'host.id',
  'telemetry.sdk.name',
  'telemetry.sdk.language',
];
