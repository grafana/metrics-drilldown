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
