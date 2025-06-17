type Filter = {
  key: string;
  operator: '=' | '!=' | '=~' | '!~' | '<' | '>';
  value: string;
};

const LABEL_REGEX = '[a-zA-Z_]\\w*'; // see https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels
const OPERATOR_REGEX = '>|<|!~|=~|!=|=';
const VALUE_REGEX = '.+';

const MATCHER_REGEX = new RegExp(`(${LABEL_REGEX})(${OPERATOR_REGEX})(${VALUE_REGEX})`);

export function parseMatcher(matcher: string): Filter {
  // eslint-disable-next-line sonarjs/slow-regex
  const [, rawKey, rawOperator, rawValue] = matcher.match(MATCHER_REGEX) || [, '', '', ''];
  return {
    key: rawKey.trim(),
    value: rawValue.replace(/['" ]/g, ''),
    operator: rawOperator.trim() as Filter['operator'],
  };
}
