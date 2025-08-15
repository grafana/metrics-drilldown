import { parser } from '@prometheus-io/lezer-promql';

export interface PromQLLabelMatcher {
  label: string;
  op: string;
  value: string;
}

export interface ParsedPromQLQuery {
  metric: string;
  labels: PromQLLabelMatcher[];
  hasErrors: boolean;
  errors: string[];
}

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

// Helper function to process label matcher nodes
export function processLabelMatcher(node: any, expr: string): PromQLLabelMatcher | null {
  if (node.name !== 'UnquotedLabelMatcher') {
    return null;
  }

  const labelNode = node.node;
  let labelName = '';
  let op = '';
  let value = '';

  // Get children of UnquotedLabelMatcher
  for (let child = labelNode.firstChild; child; child = child.nextSibling) {
    if (child.type.name === 'LabelName') {
      labelName = expr.slice(child.from, child.to);
    } else if (child.type.name === 'MatchOp') {
      op = expr.slice(child.from, child.to);
    } else if (child.type.name === 'StringLiteral') {
      value = expr.slice(child.from + 1, child.to - 1); // Remove quotes
    }
  }

  if (labelName && op) {
    // Allow empty string values
    return { label: labelName, op, value };
  }
  return null;
}
