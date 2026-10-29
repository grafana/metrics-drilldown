// Translates OpenTelemetry metric names into the names Prometheus-compatible backends store.
// The rules follow prometheus/otlptranslator (Apache-2.0, Copyright The Prometheus Authors): metric_namer.go
// and unit_namer.go. Mimir and Grafana Cloud pick a translation strategy per tenant, so a semconv metric
// can appear under several names. getMetricNameAliases returns all of them.
import { type SemconvInstrument } from './types';

export type TranslationStrategy =
  | 'NoTranslation'
  | 'NoUTF8EscapingWithSuffixes'
  | 'UnderscoreEscapingWithoutSuffixes'
  | 'UnderscoreEscapingWithSuffixes';

export const TRANSLATION_STRATEGIES: TranslationStrategy[] = [
  'UnderscoreEscapingWithSuffixes',
  'UnderscoreEscapingWithoutSuffixes',
  'NoUTF8EscapingWithSuffixes',
  'NoTranslation',
];

export const HISTOGRAM_SERIES_SUFFIXES = ['_bucket', '_count', '_sum'];

const UNIT_MAP = new Map<string, string>([
  ['d', 'days'],
  ['h', 'hours'],
  ['min', 'minutes'],
  ['s', 'seconds'],
  ['ms', 'milliseconds'],
  ['us', 'microseconds'],
  ['ns', 'nanoseconds'],
  ['By', 'bytes'],
  ['KiBy', 'kibibytes'],
  ['MiBy', 'mebibytes'],
  ['GiBy', 'gibibytes'],
  ['TiBy', 'tebibytes'],
  ['kBy', 'kilobytes'],
  ['KBy', 'kilobytes'],
  ['MBy', 'megabytes'],
  ['GBy', 'gigabytes'],
  ['TBy', 'terabytes'],
  ['m', 'meters'],
  ['V', 'volts'],
  ['A', 'amperes'],
  ['J', 'joules'],
  ['W', 'watts'],
  ['g', 'grams'],
  ['Cel', 'celsius'],
  ['Hz', 'hertz'],
  ['1', ''],
  ['%', 'percent'],
]);

const PER_UNIT_MAP = new Map<string, string>([
  ['s', 'second'],
  ['m', 'minute'],
  ['h', 'hour'],
  ['d', 'day'],
  ['w', 'week'],
  ['mo', 'month'],
  ['y', 'year'],
]);

const UNIT_WORDS = new Set([...UNIT_MAP.values()].filter(Boolean));

const hasBraces = (value: string) => /[{}]/.test(value);
const tokenize = (name: string) => name.split(/[^a-zA-Z0-9:]+/).filter(Boolean);
const withDigitPrefix = (name: string) => (/^\d/.test(name) ? `_${name}` : name);

function cleanUpUnit(unit: string): string {
  return unit
    .replace(/[^a-zA-Z0-9:]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_/, '');
}

function buildUnitSuffixes(unit: string): { main: string; per: string } {
  const slash = unit.indexOf('/');
  const mainOtel = (slash === -1 ? unit : unit.slice(0, slash)).trim();
  const perOtel = slash === -1 ? '' : unit.slice(slash + 1).trim();

  const main = mainOtel !== '' && !hasBraces(mainOtel) ? (UNIT_MAP.get(mainOtel) ?? mainOtel) : '';
  const per = perOtel !== '' && !hasBraces(perOtel) ? `per_${PER_UNIT_MAP.get(perOtel) ?? perOtel}` : '';
  return { main, per };
}

function addUnitTokens(tokens: string[], mainSuffix: string, perSuffix: string): string[] {
  let main = tokens.includes(mainSuffix) ? '' : mainSuffix;
  let per = perSuffix === 'per_' ? '' : perSuffix.replace(/_$/, '');
  if (tokens.includes(per)) {
    per = '';
  }
  if (per !== '') {
    main = main.replace(/_$/, '');
  }
  return [...tokens, ...[main, per].filter(Boolean)];
}

const removeToken = (tokens: string[], token: string) => tokens.filter((candidate) => candidate !== token);

/** UnderscoreEscapingWithSuffixes: the default translation. */
function underscoreEscapingWithSuffixes(name: string, unit: string, instrument: SemconvInstrument): string {
  const { main, per } = buildUnitSuffixes(unit);
  let tokens = addUnitTokens(tokenize(name), cleanUpUnit(main), cleanUpUnit(per));

  if (instrument === 'counter') {
    tokens = [...removeToken(tokens, 'total'), 'total'];
  }
  if (unit === '1' && instrument === 'gauge') {
    tokens = [...removeToken(tokens, 'ratio'), 'ratio'];
  }
  return withDigitPrefix(tokens.join('_'));
}

/** UnderscoreEscapingWithoutSuffixes: escaping only, no unit, _total or _ratio. */
function underscoreEscapingWithoutSuffixes(name: string): string {
  return withDigitPrefix(
    name
      .split(/[^a-zA-Z0-9:_]+/)
      .filter(Boolean)
      .join('_')
  );
}

function trimSuffixAndDelimiter(name: string, suffix: string): string {
  return name.endsWith(suffix) && name.length > suffix.length + 1
    ? name.slice(0, name.length - suffix.length - 1)
    : name;
}

/** NoUTF8EscapingWithSuffixes: dots stay, suffixes are added. */
function utf8WithSuffixes(name: string, unit: string, instrument: SemconvInstrument): string {
  const { main, per } = buildUnitSuffixes(unit);
  const isRatio = unit === '1' && instrument === 'gauge';
  const isTotal = instrument === 'counter';

  let result = name;
  if (isRatio) {
    result = trimSuffixAndDelimiter(result, 'ratio');
  }
  if (isTotal) {
    result = trimSuffixAndDelimiter(result, 'total');
  }
  if (per !== '') {
    result = trimSuffixAndDelimiter(result, per);
  }
  if (main !== '' && !result.endsWith(main)) {
    result = `${result}_${main}`;
  }
  // The reference implementation appends these last, in this order.
  return [result, per, isTotal ? 'total' : '', isRatio ? 'ratio' : ''].filter(Boolean).join('_');
}

export function toPrometheusMetricName(
  name: string,
  unit: string,
  instrument: SemconvInstrument,
  strategy: TranslationStrategy
): string {
  switch (strategy) {
    case 'UnderscoreEscapingWithSuffixes':
      return underscoreEscapingWithSuffixes(name, unit, instrument);
    case 'UnderscoreEscapingWithoutSuffixes':
      return underscoreEscapingWithoutSuffixes(name);
    case 'NoUTF8EscapingWithSuffixes':
      return utf8WithSuffixes(name, unit, instrument);
    case 'NoTranslation':
      return name;
  }
}

/** Every distinct name a semconv metric can have in Prometheus, across all translation strategies. */
export function getMetricNameAliases(name: string, unit: string, instrument: SemconvInstrument): string[] {
  const aliases = TRANSLATION_STRATEGIES.map((strategy) => toPrometheusMetricName(name, unit, instrument, strategy));
  return [...new Set(aliases.filter(Boolean))];
}

/** Removes a trailing _bucket, _count or _sum. Returns undefined when the name has none of them. */
export function stripHistogramSuffix(name: string): string | undefined {
  const suffix = HISTOGRAM_SERIES_SUFFIXES.find(
    (candidate) => name.endsWith(candidate) && name.length > candidate.length
  );
  return suffix === undefined ? undefined : name.slice(0, name.length - suffix.length);
}

/** Removes trailing _total or _ratio, a trailing _per_<time> and a trailing unit word. Used for fuzzy matching only. */
export function stripTypeAndUnitSuffix(name: string): string {
  let result = name.replace(/_(?:ratio|total)$/, '').replace(/_per_(?:day|hour|minute|month|second|week|year)$/, '');
  const lastUnderscore = result.lastIndexOf('_');
  if (lastUnderscore > 0 && UNIT_WORDS.has(result.slice(lastUnderscore + 1))) {
    result = result.slice(0, lastUnderscore);
  }
  return result;
}

/** Label names follow label_namer.go: invalid characters become '_', repeats collapse, a leading digit gets a 'key_' prefix. */
export function toPrometheusLabelName(key: string): string {
  const name = key.replace(/\W/g, '_').replace(/_+/g, '_');
  return /^\d/.test(name) ? `key_${name}` : name;
}
