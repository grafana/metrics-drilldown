import { parser } from '@prometheus-io/lezer-promql';

/**
 * Extracts all metric names from a PromQL expression
 * @param {string} promqlExpression - The PromQL expression to parse
 * @returns {string[]} An array of unique metric names found in the expression
 */
export function extractMetricNames(promqlExpression: string): string[] {
  const tree = parser.parse(promqlExpression);
  const metricNames = new Set<string>();
  const cursor = tree.cursor();

  do {
    // have we found a VectorSelector?
    if (!cursor.type.is('VectorSelector')) {
      continue;
    }

    // does it have a first child?
    if (!cursor.firstChild()) {
      continue;
    }

    do {
      // ...let's look for any Identifier node
      if (cursor.type.is('Identifier')) {
        const metricName = promqlExpression.slice(cursor.from, cursor.to);
        if (metricName) {
          metricNames.add(metricName);
        }
      }
    } while (cursor.nextSibling());

    cursor.parent();
  } while (cursor.next());

  return Array.from(metricNames);
}

/**
 * Recursively traverses a subtree to collect all LabelMatcher nodes
 */
function collectLabelMatchers(
  cursor: any,
  query: string,
  labelFilters: Array<{ label: string; op: string; value: string }>
) {
  if (cursor.type.is('UnquotedLabelMatcher')) {
    const labelMatcherText = query.slice(cursor.from, cursor.to);
    const labelMatch = labelMatcherText.match(/^([a-zA-Z_]\w*)\s*([=!~]+)\s*"((?:[^"\\]|\\.)*)"$/);
    if (labelMatch) {
      const [, label, op, value] = labelMatch;
      const unescapedValue = value.replace(/\\(.)/g, '$1');
      labelFilters.push({ label, op, value: unescapedValue });
    }
  }
  if (cursor.firstChild()) {
    do {
      collectLabelMatchers(cursor, query, labelFilters);
    } while (cursor.nextSibling());
    cursor.parent();
  }
}

/**
 * Processes a VectorSelector node to extract metric names and labels
 * @param cursor - The tree cursor positioned at a VectorSelector node
 * @param query - The original query string
 * @returns Object containing metric names and label filters found in this VectorSelector
 */
function processVectorSelector(
  cursor: any,
  query: string
): {
  metricNames: string[];
  labelFilters: Array<{ label: string; op: string; value: string }>;
} {
  const metricNames: string[] = [];
  const labelFilters: Array<{ label: string; op: string; value: string }> = [];

  if (!cursor.firstChild()) {
    return { metricNames, labelFilters };
  }

  do {
    // Extract metric name from Identifier nodes
    if (cursor.type.is('Identifier')) {
      const metricName = query.slice(cursor.from, cursor.to);
      if (metricName) {
        metricNames.push(metricName);
      }
    }
    // Recursively collect all LabelMatcher nodes
    collectLabelMatchers(cursor, query, labelFilters);
  } while (cursor.nextSibling());

  cursor.parent();
  return { metricNames, labelFilters };
}

/**
 * Parses a PromQL query to extract metric names and labels
 * @param query - The PromQL query string to parse
 * @returns Object containing metric names and label filters
 */
export function parsePromQLQuery(query: string): {
  metricNames: string[];
  labelFilters: Array<{ label: string; op: string; value: string }>;
} {
  const tree = parser.parse(query);
  const metricNames = new Set<string>();
  const labelFilters: Array<{ label: string; op: string; value: string }> = [];
  const cursor = tree.cursor();

  do {
    if (!cursor.type.is('VectorSelector')) {
      continue;
    }

    const { metricNames: vectorMetricNames, labelFilters: vectorLabelFilters } = processVectorSelector(cursor, query);

    vectorMetricNames.forEach((name) => metricNames.add(name));
    labelFilters.push(...vectorLabelFilters);
  } while (cursor.next());

  return {
    metricNames: Array.from(metricNames),
    labelFilters,
  };
}
