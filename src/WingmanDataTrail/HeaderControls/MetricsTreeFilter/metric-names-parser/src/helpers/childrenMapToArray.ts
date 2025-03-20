import { type ArrayNode, type MetricNode } from '../parseMetricsList';

const sortByCount = (a: ArrayNode, b: ArrayNode) => b.count - a.count;

export function childrenMapToArray(childrenMap: MetricNode['children']): ArrayNode[] {
  const array = [];

  for (const child of childrenMap.values()) {
    array.push({
      ...child,
      children: !child.children.size ? [] : childrenMapToArray(child.children),
    });
  }

  return array.sort(sortByCount);
}
