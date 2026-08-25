// OpenTelemetry semantic-convention attributes for known histogram-shaped metrics, organized by
// domain. Used to detect which of a metric's discovered Prometheus labels are recognized OTel
// metric-point attributes, so they can be surfaced first in the Attribute Explorer instead of mixed in
// alphabetically with everything else. Sourced from the OTel semantic-conventions spec (main branch,
// semconv v1.44.0, plus the separate semantic-conventions-genai repo for gen_ai.*). Each domain lists
// Required/Conditional/Recommended attributes only, deliberately excluding attributes the spec itself
// marks Opt-in for cardinality or sensitivity reasons (e.g. server.address/port where opt-in on
// rpc.server.call.duration, url.template, db.query.text, process.command_line,
// user_agent.synthetic.type, jvm.gc.cause): those aren't attributes the spec wants surfaced by
// default, so they shouldn't be promoted to the top here either.
//
// Excluded entirely: Go runtime histograms (go.memory.gc.pause.duration, go.schedule.duration), which
// the spec defines with no attributes at all, so there's nothing to prioritize for that runtime.
export const HISTOGRAM_ATTRIBUTES_BY_DOMAIN: Record<string, string[]> = {
  // http.server.request.duration / http.client.request.duration
  http: [
    'http.request.method',
    'url.scheme',
    'http.route',
    'http.response.status_code',
    'error.type',
    'network.protocol.name',
    'network.protocol.version',
  ],
  // rpc.server.call.duration / rpc.client.call.duration
  rpc: ['rpc.system.name', 'rpc.method', 'rpc.status_code', 'error.type', 'server.address', 'server.port'],
  // db.client.operation.duration (and the sibling db.client.connection.* / db.client.response.returned_rows metrics)
  database: [
    'db.system.name',
    'db.operation.name',
    'db.collection.name',
    'db.namespace',
    'db.response.status_code',
    'error.type',
    'db.query.summary',
    'db.stored_procedure.name',
    'network.peer.address',
    'network.peer.port',
    'server.address',
    'server.port',
  ],
  // messaging.client.operation.duration / messaging.process.duration
  messaging: [
    'messaging.operation.name',
    'messaging.system',
    'messaging.destination.name',
    'messaging.destination.subscription.name',
    'messaging.destination.template',
    'messaging.consumer.group.name',
    'messaging.operation.type',
    'messaging.destination.partition.id',
    'error.type',
    'server.address',
    'server.port',
  ],
  // jvm.gc.duration
  jvm: ['jvm.gc.action', 'jvm.gc.name'],
  // v8js.gc.duration
  v8js: ['v8js.gc.type'],
  // faas.invoke_duration / faas.init_duration / faas.cpu_usage / faas.mem_usage / faas.net_io
  faas: ['faas.trigger'],
  // cicd.pipeline.run.duration
  cicd: ['cicd.pipeline.name', 'cicd.pipeline.run.state', 'cicd.pipeline.result', 'error.type'],
  // gen_ai.client.operation.duration (semantic-conventions-genai repo, separate from the main semconv repo)
  genai: [
    'gen_ai.operation.name',
    'gen_ai.provider.name',
    'gen_ai.request.model',
    'gen_ai.response.model',
    'error.type',
    'server.address',
    'server.port',
  ],
};
