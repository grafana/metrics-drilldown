import { type SyntaxNode } from '@lezer/common';
import { parser } from '@prometheus-io/lezer-promql';

import { parseBinaryQuery } from './parseBinaryQuery';

/**
 * Rewrites a binary (ratio) query so each operand is grouped by `label`, producing the breakdown query
 * `<grouped left> <op> <grouped right>` (e.g. `sum by (env) (rate(a)) / sum by (env) (rate(b))`).
 *
 * Grouping per operand, NOT by wrapping the whole binary in `<agg> by (label) (...)`: a pre-aggregated
 * operand like `sum(rate(a[5m]))` has already collapsed its labels, so an outer `by (label)` finds
 * nothing to group and every series falls into `<unspecified>`. Instead:
 * - Pre-aggregated operand (`AggregateExpr`): inject/replace `by (label)` on its existing aggregation,
 *   keeping the operator (`sum`/`avg`/...): `sum(rate(a)) -> sum by (label) (rate(a))`.
 * - Bare operand: wrap it in `sum by (label) (...)`.
 *
 * Returns null when the input is not a clean binary (delegated to parseBinaryQuery).
 *
 * Limitations (documented, not handled): only the top-level two operands are grouped, and a scalar scale
 * that parseBinaryQuery peels off (e.g. the `100 *` in `100 * (a/b)`) is not reapplied here, so a scaled
 * ratio's breakdown is unscaled relative to the main panel.
 */
export function groupBinaryByLabel(binaryQuery: string, label: string): string | null {
  const ratio = parseBinaryQuery(binaryQuery);
  if (!ratio) {
    return null;
  }
  return `${groupOperand(ratio.left.source, label)} ${ratio.operator} ${groupOperand(ratio.right.source, label)}`;
}

function groupOperand(source: string, label: string): string {
  const aggregate = topAggregateExpr(source);
  if (!aggregate) {
    return `sum by (${label}) (${source})`;
  }

  const grouping = `by (${label})`;

  const modifier = aggregate.getChild('AggregateModifier');
  if (modifier) {
    // Replace an existing `by (...)` / `without (...)` clause with our grouping.
    return source.slice(0, modifier.from) + grouping + source.slice(modifier.to);
  }

  const op = aggregate.getChild('AggregateOp');
  if (!op) {
    return `sum by (${label}) (${source})`;
  }
  // Insert `by (label)` between the aggregation operator and its `(...)` body.
  return `${source.slice(0, op.to)} ${grouping}${source.slice(op.to)}`;
}

function topAggregateExpr(source: string): SyntaxNode | null {
  let node: SyntaxNode | null = parser.parse(source).topNode.firstChild;
  while (node && node.name === 'ParenExpr') {
    node = node.firstChild;
  }
  return node && node.name === 'AggregateExpr' ? node : null;
}
