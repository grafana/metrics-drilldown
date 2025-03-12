import { childrenMapToArray } from './helpers/childrenMapToArray';

export type MetricNode = {
  prefix: string;
  count: number;
  separator: string;
  children: Map<string, MetricNode>;
};

export type ArrayNode = {
  prefix: string;
  count: number;
  separator: string;
  children: ArrayNode[];
};

export function parseMetricsList(metricsList: string[]): { root: MetricNode; tree: ArrayNode[] } {
  const root: MetricNode = {
    prefix: '',
    count: metricsList.length,
    separator: '',
    children: new Map(),
  };

  let node: MetricNode;

  for (const metric of metricsList) {
    const [, separator = ''] = metric.match(/^[^_:]+([_:])/) || [];
    const parts = metric.split(/[_:]/);
    node = root;

    for (const part of parts) {
      const child = node.children.get(part);

      if (!child) {
        const newChild = {
          prefix: part,
          count: 1,
          separator,
          children: new Map(),
        };

        node.children.set(part, newChild);
        node = newChild;
        continue;
      }

      child.count += 1;
      node = child;
    }
  }

  const tree = Array.from(root.children.entries())
    .map(([prefix, { count, children, separator }]) => ({
      prefix,
      count,
      separator,
      children: childrenMapToArray(children),
    }))
    .sort((a, b) => b.count - a.count);

  return { root, tree };
}
