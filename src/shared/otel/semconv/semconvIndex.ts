import {
  getMetricNameAliases,
  stripHistogramSuffix,
  stripTypeAndUnitSuffix,
  toPrometheusLabelName,
} from './prometheusNames';
import {
  type SemconvAttribute,
  type SemconvData,
  type SemconvEnumMember,
  type SemconvMeta,
  type SemconvMetric,
} from './types';

export interface SemconvMetricCandidate {
  metric: SemconvMetric;
  otelName: string;
}

export interface SemconvMetricMatch {
  /** Every semconv metric that maps to the name, current metrics first. More than one means a name collision. */
  candidates: SemconvMetricCandidate[];
  /** 'exact' means the name is a known translation of the metric. 'fuzzy' means it matched after stripping type or unit suffixes. */
  kind: 'exact' | 'fuzzy';
  primary: SemconvMetricCandidate;
}

export interface SemconvLabelMatch {
  attribute: SemconvAttribute;
  otelKey: string;
}

export interface SemconvIndex {
  /** Description of one enum value of a label, for example http_request_method and GET. */
  lookupEnumValue: (labelName: string, value: number | string) => SemconvEnumMember | undefined;
  /** The semconv attribute for a Prometheus label name, or its dotted OTel name. */
  lookupLabel: (labelName: string) => SemconvLabelMatch | undefined;
  lookupMetric: (prometheusName: string) => SemconvMetricMatch | undefined;
  meta: SemconvMeta;
}

type CandidateMap = Map<string, SemconvMetricCandidate[]>;

function addCandidate(map: CandidateMap, key: string, candidate: SemconvMetricCandidate) {
  const list = map.get(key);
  if (!list) {
    map.set(key, [candidate]);
  } else if (!list.some((existing) => existing.otelName === candidate.otelName)) {
    list.push(candidate);
  }
}

// Array.prototype.sort is stable, so candidates stay alphabetical within each group.
function currentFirst(map: CandidateMap) {
  map.forEach((list) => {
    list.sort((a, b) => Number(Boolean(a.metric.deprecated)) - Number(Boolean(b.metric.deprecated)));
  });
}

function toMatch(candidates: SemconvMetricCandidate[], kind: SemconvMetricMatch['kind']): SemconvMetricMatch {
  return { candidates, kind, primary: candidates[0] };
}

// Current attributes are registered first, so a deprecated key never wins a name collision.
function buildLabelMap(attributes: SemconvData['attributes']): Map<string, SemconvLabelMatch> {
  const keys = Object.keys(attributes).sort((a, b) => a.localeCompare(b, 'en'));
  const ordered = [
    ...keys.filter((key) => !attributes[key].deprecated),
    ...keys.filter((key) => attributes[key].deprecated),
  ];

  const labels = new Map<string, SemconvLabelMatch>();
  for (const otelKey of ordered) {
    const match = { attribute: attributes[otelKey], otelKey };
    for (const alias of [toPrometheusLabelName(otelKey), otelKey]) {
      if (!labels.has(alias)) {
        labels.set(alias, match);
      }
    }
  }
  return labels;
}

// Exact value first, then ignoring case.
function findEnumMember(attribute: SemconvAttribute, value: number | string): SemconvEnumMember | undefined {
  const wanted = String(value);
  const members = attribute.members ?? [];
  return (
    members.find((member) => String(member.value) === wanted) ??
    members.find((member) => String(member.value).toLowerCase() === wanted.toLowerCase())
  );
}

export function buildSemconvIndex(data: SemconvData): SemconvIndex {
  const exact: CandidateMap = new Map();
  const fuzzy: CandidateMap = new Map();

  for (const otelName of Object.keys(data.metrics).sort((a, b) => a.localeCompare(b, 'en'))) {
    const metric = data.metrics[otelName];
    const candidate = { metric, otelName };
    for (const alias of getMetricNameAliases(otelName, metric.unit, metric.instrument)) {
      addCandidate(exact, alias, candidate);
      addCandidate(fuzzy, stripTypeAndUnitSuffix(alias), candidate);
    }
  }
  currentFirst(exact);
  currentFirst(fuzzy);
  const labels = buildLabelMap(data.attributes);

  return {
    meta: data._meta,
    lookupEnumValue: (labelName, value) => {
      const match = labels.get(labelName);
      return match ? findEnumMember(match.attribute, value) : undefined;
    },
    lookupLabel: (labelName) => labels.get(labelName),
    lookupMetric: (prometheusName) => {
      const direct = exact.get(prometheusName);
      if (direct) {
        return toMatch(direct, 'exact');
      }

      // Histogram series are exposed as <name>_bucket, <name>_count and <name>_sum.
      const histogramBase = stripHistogramSuffix(prometheusName);
      const histograms = histogramBase === undefined ? [] : (exact.get(histogramBase) ?? []);
      const histogramMatches = histograms.filter((candidate) => candidate.metric.instrument === 'histogram');
      if (histogramMatches.length > 0) {
        return toMatch(histogramMatches, 'exact');
      }

      const loose = fuzzy.get(stripTypeAndUnitSuffix(histogramBase ?? prometheusName));
      return loose ? toMatch(loose, 'fuzzy') : undefined;
    },
  };
}
