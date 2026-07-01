import { type SyntaxNode } from '@lezer/common';
import { parser } from '@prometheus-io/lezer-promql';

import { type PromQLLabelMatcher } from './utils.promql';

/**
 * Parses a binary PromQL expression (e.g. a ratio insight KG has unwrapped from a recording rule)
 * into the two operands and their leaf metric selectors, so GMD can run per-operand label discovery
 * and build breakdown queries.
 *
 * Returns null for anything that is not a clean single-level binary over `/ * + -` (single metric,
 * vector matching, parse errors, unsupported operators) so the caller falls back to the
 * single-metric path. Validated against the live lezer tree, see pr-plans-1132-gmd-binary-expression-v2.md.
 */

// Operator token node names in @prometheus-io/lezer-promql -> the PromQL symbol.
const OPERATORS: Record<string, '/' | '*' | '+' | '-'> = {
  Div: '/',
  Mul: '*',
  Add: '+',
  Sub: '-',
};

export interface BinaryLeaf {
  metricName: string;
  labels: PromQLLabelMatcher[];
}

export interface BinarySide {
  /** PromQL source of this operand (paren-unwrapped), ready to wrap in an aggregation. */
  source: string;
  /** Every metric selector found in this operand. Usually one; more for nested operands. */
  leaves: BinaryLeaf[];
  /** True when the operand's top node is already an aggregation (e.g. `sum(rate(...))`). */
  preAggregated: boolean;
}

export interface BinaryRatio {
  operator: '/' | '*' | '+' | '-';
  left: BinarySide;
  right: BinarySide;
}

export function parseBinaryQuery(expr: string): BinaryRatio | null {
  const tree = parser.parse(expr);

  let hasError = false;
  tree.iterate({
    enter: (node) => {
      if (node.type.isError || node.name === '⚠') {
        hasError = true;
      }
    },
  });
  if (hasError) {
    return null;
  }

  return findRatioBinary(tree.topNode, expr);
}

/**
 * Finds the meaningful metric-vs-metric binary under `node`, peeling scalar wrappers.
 *
 * KG queries are commonly scalar-scaled, e.g. `100 * (errors / requests)`. The top-level
 * operator there is `*` with a scalar-only operand; the real ratio is nested. When one operand
 * has no metric selector, we recurse into the other to find the actual binary. A scalar-scaled
 * single metric (`100 * kg_metric`) yields null (no inner binary) so the caller falls
 * back to the single-metric path; KG is expected to send the unwrapped binary, not the rule.
 */
function findRatioBinary(node: SyntaxNode, expr: string): BinaryRatio | null {
  const bin = findFirstBinaryExpr(node);
  if (!bin) {
    return null;
  }

  const children: SyntaxNode[] = [];
  for (let child = bin.firstChild; child; child = child.nextSibling) {
    children.push(child);
  }
  if (children.length < 3) {
    return null;
  }

  const leftNode = children[0];
  const rightNode = children[children.length - 1];
  const middle = children.slice(1, -1);

  // Exactly one operator token between the two operands. A vector-matching modifier
  // (on()/ignoring()/group_left/right) appears here as an extra `MatchingModifierClause`,
  // so this rejects those without hardcoding the modifier node name.
  if (middle.length !== 1) {
    return null;
  }

  const operator = OPERATORS[middle[0].name];
  if (!operator) {
    return null; // and/or/unless/comparison etc.
  }

  const left = buildSide(leftNode, expr);
  const right = buildSide(rightNode, expr);
  const leftScalar = left.leaves.length === 0;
  const rightScalar = right.leaves.length === 0;

  if (!leftScalar && !rightScalar) {
    return { operator, left, right };
  }
  if (leftScalar && rightScalar) {
    return null;
  }

  // One operand is scalar-only: the meaningful expression is the other operand.
  return findRatioBinary(leftScalar ? rightNode : leftNode, expr);
}

/** First `BinaryExpr` in pre-order = the top-level (loosest-binding) operator. */
function findFirstBinaryExpr(node: SyntaxNode): SyntaxNode | null {
  if (node.name === 'BinaryExpr') {
    return node;
  }
  for (let child = node.firstChild; child; child = child.nextSibling) {
    const found = findFirstBinaryExpr(child);
    if (found) {
      return found;
    }
  }
  return null;
}

function buildSide(node: SyntaxNode, expr: string): BinarySide {
  // Unwrap wrapping parens so the slice is `A + 2`, not `(A + 2)`.
  let inner = node;
  while (inner.name === 'ParenExpr' && inner.firstChild) {
    inner = inner.firstChild;
  }

  const vectorSelectors: SyntaxNode[] = [];
  collectVectorSelectors(inner, vectorSelectors);

  return {
    source: expr.slice(inner.from, inner.to),
    preAggregated: inner.name === 'AggregateExpr',
    leaves: vectorSelectors.map((vs) => leafFromVectorSelector(vs, expr)),
  };
}

function collectVectorSelectors(node: SyntaxNode, out: SyntaxNode[]): void {
  if (node.name === 'VectorSelector') {
    out.push(node);
  }
  for (let child = node.firstChild; child; child = child.nextSibling) {
    collectVectorSelectors(child, out);
  }
}

function matcherFromNode(m: SyntaxNode, expr: string): PromQLLabelMatcher | null {
  let label = '';
  let op = '';
  let value = '';
  for (let ch = m.firstChild; ch; ch = ch.nextSibling) {
    if (ch.name === 'LabelName') {
      label = expr.slice(ch.from, ch.to);
    } else if (ch.name === 'MatchOp') {
      op = expr.slice(ch.from, ch.to);
    } else if (ch.name === 'StringLiteral') {
      value = expr.slice(ch.from + 1, ch.to - 1); // strip quotes
    }
  }
  return label && op ? { label, op, value } : null;
}

function leafFromVectorSelector(vs: SyntaxNode, expr: string): BinaryLeaf {
  const id = vs.getChild('Identifier');
  const metricName = id ? expr.slice(id.from, id.to) : '';

  const labels: PromQLLabelMatcher[] = [];
  const matchers = vs.getChild('LabelMatchers');
  for (let m = matchers?.firstChild; m; m = m.nextSibling) {
    if (m.name !== 'UnquotedLabelMatcher') {
      continue;
    }
    const matcher = matcherFromNode(m, expr);
    if (matcher) {
      labels.push(matcher);
    }
  }

  return { metricName, labels };
}
