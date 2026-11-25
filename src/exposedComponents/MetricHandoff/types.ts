import { type AdHocVariableFilter } from '@grafana/data';
import { type PromQuery } from '@grafana/prometheus';

export interface MetricHandoffProps {
  /** Prometheus data source UID. Targets referencing a different data source are not offered in Explore. */
  dataSourceUid: string;
  /** Absolute time or Grafana date math. Numbers are epoch milliseconds. */
  from: string | number;
  to: string | number;
  /**
   * Single-value Prometheus matchers applied only to Drilldown (AND semantics).
   * Literal Scenes URL escape tokens (__gfp__, __gfc__, __gfh__) in keys or values suppress
   * Drilldown because its URL handler cannot represent them losslessly. Values equal to '""'
   * or containing template syntax also suppress Drilldown: its legacy formatter reinterprets them.
   * Explore targets must already include their intended matchers.
   */
  filters?: AdHocVariableFilter[];
  /** Exact Explore targets; expressions, including Grafana rate macros, are not rewritten. */
  queries: PromQuery[];
  /**
   * Explicit metric name, not an expression. Drilldown opens this metric with its type-aware defaults,
   * not the Explore expressions. Metric names, filter keys and group-by names exclude control
   * characters, quotes, backslashes, braces, template dollars and legacy [[ openers that downstream
   * builders cannot safely represent; dotted and UTF-8 names are supported.
   */
  metric?: string;
  groupBy?: string;
}
