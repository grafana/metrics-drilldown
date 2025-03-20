import { childrenMapToArray } from './helpers/childrenMapToArray';

export type MetricPart = {
  type: 'sep' | 'part';
  part: string;
};

export type MetricNode = {
  path: string;
  part: string;
  count: number;
  children: Map<string, MetricNode>;
};

export type ArrayNode = {
  path: string;
  part: string;
  count: number;
  children: ArrayNode[];
};

export type ParseOptions = {
  convertToArray?: boolean;
};

const REGEX_SEP_PART = /([_:]+|[^_:]+)/g;

function extractMetricParts(metric: string): MetricPart[] {
  const matches = metric.matchAll(REGEX_SEP_PART);

  return Array.from(matches).map(([part]) => ({
    type: part[0] === '_' || part[0] === ':' ? 'sep' : 'part',
    part,
  }));
}

const REGEX_RECORDING_RULE = /:/;

export function isRecordingRule(metric: string): boolean {
  return REGEX_RECORDING_RULE.test(metric);
}

export function parseMetricsList(metricsList: string[], options: ParseOptions = {}): MetricNode | ArrayNode[] {
  const treeRoot: MetricNode = {
    part: '',
    path: '',
    count: metricsList.length,
    children: new Map(),
  };

  let node: MetricNode;

  for (const metric of metricsList) {
    node = treeRoot;
    let currentPath = '';

    for (const { type, part } of extractMetricParts(metric)) {
      if (type === 'sep') {
        currentPath += part;
        continue;
      }

      const child = node.children.get(part);

      if (!child) {
        const newChild: MetricNode = {
          part,
          path: currentPath,
          count: 1,
          children: new Map(),
        };

        node.children.set(part, newChild);
        node = newChild;
        currentPath += part;
        continue;
      }

      child.count += 1;
      node = child;
      currentPath += part;
    }
  }

  return options.convertToArray ? childrenMapToArray(treeRoot.children) : treeRoot;
}
