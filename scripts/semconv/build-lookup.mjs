// Validates Weaver's resolved semantic conventions output and writes the compact, deterministic
// lookup JSON that src/shared/otel/semconv loads at runtime.
//
// Usage: node scripts/semconv/build-lookup.mjs <weaver-output.json> <target.json>
// Reads SEMCONV_VERSION and WEAVER_VERSION from the environment (set by generate.sh).
//
// Fails loudly (exit 1, nothing written) if the Weaver output has an unexpected shape, so a Weaver or
// schema change never silently produces an empty or partial table.

import { readFileSync, writeFileSync } from 'node:fs';

const MIN_METRICS = 450;
const MIN_ATTRIBUTES = 850;
const ANCHOR_METRICS = ['http.server.request.duration', 'db.client.operation.duration', 'process.cpu.time'];
const ANCHOR_ATTRIBUTES = ['http.request.method', 'service.name', 'error.type'];
const INSTRUMENTS = new Set(['counter', 'gauge', 'histogram', 'updowncounter']);
const STABILITIES = new Set(['alpha', 'beta', 'development', 'experimental', 'release_candidate', 'stable']);
const DEPRECATION_REASONS = new Set(['obsoleted', 'renamed', 'uncategorized']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function validateMetric(name, metric, attributeKeys, errors) {
  if (typeof metric.brief !== 'string' || metric.brief === '') {
    errors.push(`${name}: brief`);
  }
  if (!INSTRUMENTS.has(metric.instrument)) {
    errors.push(`${name}: instrument ${metric.instrument}`);
  }
  if (typeof metric.unit !== 'string') {
    errors.push(`${name}: unit`);
  }
  if (!STABILITIES.has(metric.stability)) {
    errors.push(`${name}: stability ${metric.stability}`);
  }
  if (!Array.isArray(metric.attributes)) {
    errors.push(`${name}: attributes`);
  } else {
    metric.attributes
      .filter((key) => !attributeKeys.has(key))
      .forEach((key) => errors.push(`${name}: dangling attribute ${key}`));
  }
  if (metric.deprecated && !(isObject(metric.deprecated) && DEPRECATION_REASONS.has(metric.deprecated.reason))) {
    errors.push(`${name}: deprecated shape`);
  }
}

function validateAttribute(key, attribute, errors) {
  if (typeof attribute.brief !== 'string') {
    errors.push(`${key}: brief`);
  }
  if (typeof attribute.type !== 'string') {
    errors.push(`${key}: type`);
  }
  if (attribute.type === 'enum' && !(Array.isArray(attribute.members) && attribute.members.length > 0)) {
    errors.push(`${key}: enum members`);
  }
}

function validate(data) {
  if (!isObject(data) || !isObject(data.metrics) || !isObject(data.attributes)) {
    return ['top-level metrics or attributes missing'];
  }

  const errors = [];
  const metricNames = Object.keys(data.metrics);
  const attributeKeys = new Set(Object.keys(data.attributes));

  if (metricNames.length < MIN_METRICS) {
    errors.push(`metric count ${metricNames.length} is below ${MIN_METRICS}`);
  }
  if (attributeKeys.size < MIN_ATTRIBUTES) {
    errors.push(`attribute count ${attributeKeys.size} is below ${MIN_ATTRIBUTES}`);
  }
  ANCHOR_METRICS.filter((name) => !data.metrics[name]).forEach((name) => errors.push(`anchor metric missing: ${name}`));
  ANCHOR_ATTRIBUTES.filter((key) => !attributeKeys.has(key)).forEach((key) =>
    errors.push(`anchor attribute missing: ${key}`)
  );

  for (const [name, metric] of Object.entries(data.metrics)) {
    validateMetric(name, metric, attributeKeys, errors);
  }
  for (const [key, attribute] of Object.entries(data.attributes)) {
    validateAttribute(key, attribute, errors);
  }
  return errors;
}

function shapeDeprecation(deprecated) {
  if (!deprecated) {
    return undefined;
  }
  return { reason: deprecated.reason, renamedTo: deprecated.renamed_to ?? undefined };
}

function shapeMember(member) {
  return { brief: member.brief || undefined, deprecated: member.deprecated ? true : undefined, value: member.value };
}

function shape(data) {
  const metrics = {};
  for (const [name, metric] of Object.entries(data.metrics)) {
    metrics[name] = {
      attributes: [...metric.attributes].sort(),
      brief: metric.brief,
      deprecated: shapeDeprecation(metric.deprecated),
      instrument: metric.instrument,
      stability: metric.stability,
      unit: metric.unit,
    };
  }

  const attributes = {};
  for (const [key, attribute] of Object.entries(data.attributes)) {
    attributes[key] = {
      brief: attribute.brief,
      deprecated: shapeDeprecation(attribute.deprecated),
      members: attribute.members ? attribute.members.map(shapeMember) : undefined,
      stability: attribute.stability,
      type: attribute.type,
    };
  }

  return {
    _meta: {
      license: 'Apache-2.0',
      semconvVersion: process.env.SEMCONV_VERSION,
      source: 'https://github.com/open-telemetry/semantic-conventions',
      weaverVersion: process.env.WEAVER_VERSION,
    },
    attributes,
    metrics,
  };
}

// Sorts object keys so the output does not depend on Weaver's ordering. Arrays keep their order.
function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])])
    );
  }
  return value;
}

function main() {
  const [input, target] = process.argv.slice(2);
  if (!input || !target || !process.env.SEMCONV_VERSION || !process.env.WEAVER_VERSION) {
    process.stderr.write('Usage: SEMCONV_VERSION=... WEAVER_VERSION=... build-lookup.mjs <input.json> <target.json>\n');
    process.exit(2);
  }

  const data = JSON.parse(readFileSync(input, 'utf8'));
  const errors = validate(data);
  if (errors.length > 0) {
    process.stderr.write(`Weaver output validation failed:\n${errors.slice(0, 20).join('\n')}\n`);
    process.exit(1);
  }

  // JSON.stringify drops undefined values, which keeps absent optional fields out of the file.
  writeFileSync(target, `${JSON.stringify(sortKeys(shape(data)), null, 2)}\n`);
  process.stdout.write(
    `Wrote ${Object.keys(data.metrics).length} metrics and ${Object.keys(data.attributes).length} attributes to ${target}\n`
  );
}

main();
