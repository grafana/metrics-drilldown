import { type SyntaxNode } from '@lezer/common';
import { parser } from '@prometheus-io/lezer-promql';

/**
 * Injects `{label="value"}` into every `VectorSelector` of a PromQL expression and returns the modified
 * expression. Used to scope a binary (ratio) query to a single breakdown value for the per-value
 * drilldown, e.g. turning `rate(errors{...}[5m]) / rate(requests{...}[5m])` into the same ratio with
 * `path="/foo"` added to both operands.
 *
 * Behaviour per selector:
 * - Selector with `{...}`: insert the matcher; if a matcher for the same `label` already exists it is
 *   REPLACED (appending would create a contradictory `label="a", label="b"` that matches nothing).
 * - Bare selector (`metric`, colon names, no braces): add `{label="value"}`.
 * - Injects into every selector, so multi-leaf operands (`(a*b)/c`) and pre-aggregated operands
 *   (`sum(rate(errors{...}[5m]))` -> the inner `errors` selector) are all covered.
 *
 * Scope: intended for a top-level 2-operand binary (what `parseBinaryQuery` accepts); it injects into
 * every leaf selector on both sides. Value matching is exact (`=`). If the expression fails to parse the
 * original string is returned unchanged.
 */
export function injectLabelMatcher(expr: string, label: string, value: string): string {
  const tree = parser.parse(expr);
  const matcher = `${label}="${escapeLabelValue(value)}"`;

  // Collect edits first, then apply right-to-left so earlier offsets stay valid as we splice.
  const edits: Array<{ from: number; to: number; text: string }> = [];
  let hasError = false;

  tree.iterate({
    enter: (node) => {
      if (node.type.isError || node.name === '⚠') {
        hasError = true;
        return;
      }
      if (node.name !== 'VectorSelector') {
        return;
      }

      const vectorSelector = node.node;
      const labelMatchers = vectorSelector.getChild('LabelMatchers');

      if (!labelMatchers) {
        // Bare selector: append a fresh brace block right after it.
        edits.push({ from: vectorSelector.to, to: vectorSelector.to, text: `{${matcher}}` });
        return;
      }

      const existing = findLabelMatcherNode(labelMatchers, label, expr);
      if (existing) {
        edits.push({ from: existing.from, to: existing.to, text: matcher });
        return;
      }

      // Insert just before the closing `}`. Add a leading comma only when the braces are non-empty.
      const insertPos = labelMatchers.to - 1;
      const hasContent = expr.slice(labelMatchers.from + 1, labelMatchers.to - 1).trim().length > 0;
      edits.push({ from: insertPos, to: insertPos, text: hasContent ? `, ${matcher}` : matcher });
    },
  });

  if (hasError) {
    return expr;
  }

  edits.sort((a, b) => b.from - a.from);
  return edits.reduce((acc, edit) => acc.slice(0, edit.from) + edit.text + acc.slice(edit.to), expr);
}

function findLabelMatcherNode(labelMatchers: SyntaxNode, label: string, expr: string): SyntaxNode | null {
  for (let m = labelMatchers.firstChild; m; m = m.nextSibling) {
    if (m.name !== 'UnquotedLabelMatcher') {
      continue;
    }
    const nameNode = m.getChild('LabelName');
    if (nameNode && expr.slice(nameNode.from, nameNode.to) === label) {
      return m;
    }
  }
  return null;
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
