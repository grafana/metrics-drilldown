import { Expression, MatchingOperator } from 'tsqtsq';

import { VAR_FILTERS_EXPR } from 'shared';

import { buildQueryExpression, expressionToString } from '../buildQueryExpression';

describe('buildQueryExpression(options)', () => {
  test('returns the expected expression', () => {
    const options = {
      metric: '🔥go_goroutines',
      labelMatchers: [{ key: 'instance', operator: '=', value: 'us-east:5000' }],
      addIgnoreUsageFilter: true,
    };

    const expression = buildQueryExpression(options);

    expect(expression.metric).toBe('🔥go_goroutines');
    expect(expression.selectors).toMatchInlineSnapshot(`
      Map {
        "instance" => [
          {
            "label": "instance",
            "operator": "=",
            "value": "us-east:5000",
          },
        ],
        "__ignore_usage__" => [
          {
            "label": "__ignore_usage__",
            "operator": "=",
            "value": "",
          },
        ],
        ""🔥go_goroutines"" => [
          {
            "label": ""🔥go_goroutines"",
            "operator": "=",
            "value": "__REMOVE__",
          },
        ],
        "\${filters}" => [
          {
            "label": "\${filters}",
            "operator": "=",
            "value": "__REMOVE__",
          },
        ],
      }
    `);
  });
});

describe('expressionToString(expression)', () => {
  test('returns the correct string', () => {
    const expression = new Expression({
      metric: 'go_goroutines',
      values: {},
      defaultOperator: MatchingOperator.equal,
      defaultSelectors: [
        { label: 'instance', operator: MatchingOperator.equal, value: 'us-east:5000' },
        { label: '__ignore_usage__', operator: MatchingOperator.equal, value: '' },
        { label: VAR_FILTERS_EXPR, operator: MatchingOperator.equal, value: '__REMOVE__' },
      ],
    });

    expect(expressionToString(expression)).toBe(
      'go_goroutines{instance="us-east:5000", __ignore_usage__="", ${filters}}'
    );
  });
});
