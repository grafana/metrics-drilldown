import { isValidLegacyName, utf8Support } from '@grafana/prometheus';
import { Expression, MatchingOperator, promql } from 'tsqtsq';

import { VAR_FILTERS } from 'shared/shared';

import { type Metric } from './matchers/getMetricType';

export type LabelMatcher = {
  key: string;
  operator: string;
  value: string;
};

function expressionToString(expression: Expression) {
  // see hacks in buildQueryExpression() below
  return expression.toString().replaceAll('="__REMOVE__"', '');
}

type Options = {
  metric: Metric;
  labelMatchers?: LabelMatcher[];
  addIgnoreUsageFilter?: boolean;
  addExtremeValuesFiltering?: boolean;
};

export function buildQueryExpression(options: Options): string {
  const { metric, labelMatchers = [], addIgnoreUsageFilter = true, addExtremeValuesFiltering = false } = options;

  const defaultSelectors = labelMatchers.map((m) => ({
    label: utf8Support(m.key),
    operator: m.operator as MatchingOperator,
    value: m.value,
  }));

  if (addIgnoreUsageFilter) {
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings -- This is a PromQL label name, not user-facing text
    defaultSelectors.push({ label: '__ignore_usage__', operator: MatchingOperator.equal, value: '' });
  }

  const isUtf8Metric = !isValidLegacyName(metric.name);
  if (isUtf8Metric) {
    // hack to have the UTF-8 metric name in braces alongside labels
    // but without extra quotes associated with an empty label value
    defaultSelectors.push({ label: utf8Support(metric.name), operator: MatchingOperator.equal, value: '__REMOVE__' });
    // Because we've added the metric name as a label matcher, we set the metric name to an empty string for the Expression below
  }

  // hack for Scenes to interpolate the VAR_FILTERS variable
  // added last so that, if filters are empty, the query is still valid
  // and we're using :raw for variables containing special characters (like equal signs etc.)
  defaultSelectors.push({ label: `\${${VAR_FILTERS}:raw}`, operator: MatchingOperator.equal, value: '__REMOVE__' });

  const expression = new Expression({
    metric: isUtf8Metric ? '' : metric.name,
    values: {},
    defaultOperator: MatchingOperator.equal,
    defaultSelectors,
  });

  const expressionString = expressionToString(expression);

  if (addExtremeValuesFiltering) {
    return promql.and({
      left: expressionString,
      right: `${expressionString} > -Inf`,
    });
  }

  return expressionString;
}

// Rewrites a classic-histogram _bucket selector's metric name to reference a sibling series (e.g.
// _count, _sum), handling both selector shapes buildQueryExpression above can produce. A legacy metric
// name is a plain prefix before the opening brace (metric_bucket{...}). A UTF-8 metric name has no such
// prefix: PromQL has no bare metricName{...} syntax for non-legacy names, so isUtf8Metric above embeds
// it instead as a quoted, operator-less matcher just inside the opening brace (e.g. {"🔥_bucket", ...}),
// which a plain indexOf('{') split leaves untouched.
export function renameBucketMetricSuffix(bucketSelector: string, newSuffix: string): string {
  const utf8Match = bucketSelector.match(/([{,]\s*)"([^"]*)_bucket"(?=\s*[,}])/);
  if (utf8Match) {
    const [fullMatch, prefix, namePrefix] = utf8Match;
    return bucketSelector.replace(fullMatch, `${prefix}"${namePrefix}${newSuffix}"`);
  }

  const openBrace = bucketSelector.indexOf('{');
  const metricName = openBrace === -1 ? bucketSelector : bucketSelector.slice(0, openBrace);
  const rest = openBrace === -1 ? '' : bucketSelector.slice(openBrace);
  return `${metricName.replace(/_bucket$/, newSuffix)}${rest}`;
}
