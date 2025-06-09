type Filter = {
  key: string;
  operator: '=' | '!=' | '=~' | '!~' | '<' | '>';
  value: string;
};

export function parseMatcher(matcher: string): Filter {
  // eslint-disable-next-line sonarjs/slow-regex
  const [, rawKey, rawOperator, rawValue] = matcher.match(/([a-z0-9]+)(>|<|!~|=~|!=|=)(.+)/i) || [, '', '', ''];
  return {
    key: rawKey.trim(),
    value: rawValue.replace(/['" ]/g, ''),
    operator: rawOperator.trim() as Filter['operator'],
  };
}
