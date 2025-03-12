import { type ArrayNode, type MetricNode } from '../parseMetricsList';

export function childrenMapToArray(childrenMap: Map<string, MetricNode>): ArrayNode[] {
  const array = [];

  for (const [prefix, metricNode] of childrenMap.entries()) {
    array.push({
      prefix,
      count: metricNode.count,
      separator: metricNode.separator,
      children: !metricNode.children.size ? [] : childrenMapToArray(metricNode.children),
    });
  }

  return array.sort((a, b) => b.count - a.count);
}
