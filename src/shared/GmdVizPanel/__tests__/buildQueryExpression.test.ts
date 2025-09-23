import { MatchingOperator } from 'tsqtsq';

import { buildQueryExpression } from '../buildQueryExpression';

describe('buildQueryExpression(options)', () => {
  test.each([
    ['non-utf8', 'go_goroutines', 'go_goroutines{${filters:raw}}'],
    ['utf8', '🔥go_goroutines', '🔥go_goroutines{"🔥go_goroutines", ${filters:raw}}'],
  ])('supports %s metric names', (_, name, expected) => {
    const expression = buildQueryExpression({
      metric: { name, type: 'gauge' },
      labelMatchers: [],
      addIgnoreUsageFilter: false,
      addExtremeValuesFiltering: false,
    });

    expect(expression).toBe(expected);
  });

  test.each([
    ['non-utf8', 'go_goroutines', 'go_goroutines{cluster="test", instance!="us-east:5000", ${filters:raw}}'],
    [
      'utf8',
      '🔥go_goroutines',
      '🔥go_goroutines{cluster="test", instance!="us-east:5000", "🔥go_goroutines", ${filters:raw}}',
    ],
  ])('supports labels (%s)', (_, name, expected) => {
    const expression = buildQueryExpression({
      metric: { name, type: 'gauge' },
      labelMatchers: [
        { key: 'cluster', operator: MatchingOperator.equal, value: 'test' },
        { key: 'instance', operator: MatchingOperator.notEqual, value: 'us-east:5000' },
      ],
      addIgnoreUsageFilter: false,
      addExtremeValuesFiltering: false,
    });

    expect(expression).toBe(expected);
  });

  test.each([
    [
      'non-utf8',
      'go_goroutines',
      'go_goroutines{cluster="test", instance!="us-east:5000", __ignore_usage__="", ${filters:raw}}',
    ],
    [
      'utf8',
      '🔥go_goroutines',
      '🔥go_goroutines{cluster="test", instance!="us-east:5000", __ignore_usage__="", "🔥go_goroutines", ${filters:raw}}',
    ],
  ])('supports ignore usage filter (%s)', (_, name, expected) => {
    const expression = buildQueryExpression({
      metric: { name, type: 'gauge' },
      labelMatchers: [
        { key: 'cluster', operator: MatchingOperator.equal, value: 'test' },
        { key: 'instance', operator: MatchingOperator.notEqual, value: 'us-east:5000' },
      ],
      addIgnoreUsageFilter: true,
      addExtremeValuesFiltering: false,
    });

    expect(expression).toBe(expected);
  });
});

describe('extreme value filtering', () => {
  test.each([
    [
      'non-utf8',
      'go_goroutines',
      'go_goroutines{cluster="test", instance!="us-east:5000", __ignore_usage__="", ${filters:raw}} and go_goroutines{cluster="test", instance!="us-east:5000", __ignore_usage__="", ${filters:raw}} > -Inf',
    ],
    [
      'utf8',
      '🔥go_goroutines',
      '🔥go_goroutines{cluster="test", instance!="us-east:5000", __ignore_usage__="", "🔥go_goroutines", ${filters:raw}} and 🔥go_goroutines{cluster="test", instance!="us-east:5000", __ignore_usage__="", "🔥go_goroutines", ${filters:raw}} > -Inf',
    ],
  ])('supports extreme value filtering  (%s)', (_, name, expected) => {
    const expression = buildQueryExpression({
      metric: { name, type: 'gauge' },
      labelMatchers: [
        { key: 'cluster', operator: MatchingOperator.equal, value: 'test' },
        { key: 'instance', operator: MatchingOperator.notEqual, value: 'us-east:5000' },
      ],
      addIgnoreUsageFilter: true,
      addExtremeValuesFiltering: true,
    });

    expect(expression).toBe(expected);
  });
});
