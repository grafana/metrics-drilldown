import { utf8Support } from '@grafana/prometheus';
import * as promql from '@grafana/promql-builder';

/**
 * Builds a vector expression for a custom metric with UTF-8 characters in the metric name or labels.
 *
 * @example
 * ```ts
 * // returns `{"a.utf8.metric 🤘",__ignore_usage__="",label with 📈="metrics"}`
 * new Utf8MetricExprBuilder(
 *   "a.utf8.metric 🤘",
 *   [
 *     { name: "__ignore_usage__", value: "" },
 *     { name: "label with 📈", value: "metrics" },
 *   ],
 *   "5m"
 * );
 * ```
 *
 * @example
 * ```ts
 * // returns `sum(rate({"node_cpu_seconds_total",mode="idle",instance="localhost:9100"}[1h]))`
 * promql.sum(promql.rate(new Utf8MetricExprBuilder(
 *   "node_cpu_seconds_total",
 *   [
 *     { name: "mode", value: "idle" },
 *     { name: "instance", value: "localhost:9100" },
 *   ],
 *   "1h"
 * )));
 * ```
 *
 * See {@link https://prometheus.io/docs/guides/utf8 | the Prometheus UTF-8 Guide} for more information on how to use UTF-8 characters in PromQL.
 */
export class Utf8MetricExprBuilder implements promql.Builder<promql.Expr> {
  private expr: promql.VectorExpr;

  constructor(metricName: string, labels: promql.LabelSelector[] = [], range?: string) {
    this.expr = promql.defaultVectorExpr();

    // First label is the metric name with empty key
    const allLabels: promql.LabelSelector[] = [
      {
        name: '',
        value: metricName,
        operator: '' as promql.LabelMatchingOperator, // This is a hack, but without it, the metric name is erroneously prefixed by '='.
      },
      ...labels.map((label) => ({
        name: utf8Support(label.name),
        value: utf8Support(label.value),
        operator: label.operator,
      })),
    ];

    this.expr.labels = allLabels;

    if (range) {
      this.expr.range = range;
    }
  }

  build(): promql.Expr {
    return this.expr;
  }

  toString(): string {
    return promql.toString(this.expr);
  }
}
