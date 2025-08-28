import { isValidLegacyName, utf8Support } from '@grafana/prometheus';
import { Expression, MatchingOperator } from 'tsqtsq';

import { VAR_FILTERS } from 'shared';

export type LabelMatcher = {
  key: string;
  operator: string;
  value: string;
};

export function expressionToString(expression: Expression) {
  // see hacks in buildQueryExpression() below
  return expression.toString().replaceAll('="__REMOVE__"', '');
}

type Options = {
  metric: string;
  labelMatchers?: LabelMatcher[];
  addIgnoreUsageFilter?: boolean;
};

export function buildQueryExpression(options: Options): Expression {
  const { metric, labelMatchers = [], addIgnoreUsageFilter = true } = options;

  const defaultSelectors = labelMatchers.map((m) => ({
    label: utf8Support(m.key),
    operator: m.operator as MatchingOperator,
    value: m.value,
  }));

  if (addIgnoreUsageFilter) {
    defaultSelectors.push({ label: '__ignore_usage__', operator: MatchingOperator.equal, value: '' });
  }

  const isUtf8Metric = !isValidLegacyName(metric);
  if (isUtf8Metric) {
    // hack to have the UTF-8 metric name in braces alongside labels
    // but without extra quotes associated with an empty label value
    defaultSelectors.push({ label: utf8Support(metric), operator: MatchingOperator.equal, value: '__REMOVE__' });
  }

  // hack for Scenes to interpolate the VAR_FILTERS variable
  // added last so that, if filters are empty, the query is still valid
  // and we're using :raw for variables containing special characters (like equal signs etc.)
  defaultSelectors.push({ label: `\${${VAR_FILTERS}:raw}`, operator: MatchingOperator.equal, value: '__REMOVE__' });

  return new Expression({
    metric,
    values: {},
    defaultOperator: MatchingOperator.equal,
    defaultSelectors,
  });
}
