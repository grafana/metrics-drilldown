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

/**
 * Parses a PromQL query and extracts labels specifically from rate() function calls.
 * This function ignores labels from other parts of the query like unless clauses or ALERTS.
 *
 * @param expr - The PromQL expression to parse
 * @returns ParsedPromQLQuery with labels only from rate functions
 */
export function extractLabelsFromRateFunction(expr: string): ParsedPromQLQuery {
  const tree = parser.parse(expr);
  let metric = '';
  const labels: PromQLLabelMatcher[] = [];
  let hasErrors = false;
  const errors: string[] = [];

  // Track if we're currently inside a rate function
  let insideRateFunction = false;

  tree.iterate({
    enter: (node) => {
      // Check if this is an error node
      if (node.type.isError || node.name === '⚠') {
        hasErrors = true;
        const errorText = expr.slice(node.from, node.to);
        const errorMsg = errorText
          ? `Parse error at position ${node.from}-${node.to}: "${errorText}"`
          : `Parse error at position ${node.from}`;
        errors.push(errorMsg);
      }

      // Check if we're entering a rate function by looking for the Rate node
      if (node.name === 'Rate' || (node.name === 'FunctionIdentifier' && expr.slice(node.from, node.to) === 'rate')) {
        insideRateFunction = true;
      }

      // Extract metric name from the first VectorSelector found in any rate function
      if (
        insideRateFunction &&
        !metric &&
        node.name === 'Identifier' &&
        node.node.parent?.type.name === 'VectorSelector'
      ) {
        metric = expr.slice(node.from, node.to);
      }

      // Extract label matchers only when inside a rate function
      if (insideRateFunction) {
        const labelData = processLabelMatcher(node, expr);
        if (labelData) {
          // Check if this label combination already exists to avoid duplicates
          const exists = labels.some(
            (existingLabel) =>
              existingLabel.label === labelData.label &&
              existingLabel.op === labelData.op &&
              existingLabel.value === labelData.value
          );
          if (!exists) {
            labels.push(labelData);
          }
        }
      }
    },
    leave: (node) => {
      // Reset flag when leaving a rate function
      if (node.name === 'FunctionCall') {
        insideRateFunction = false;
      }
    },
  });

  return { metric, labels, hasErrors, errors };
}
