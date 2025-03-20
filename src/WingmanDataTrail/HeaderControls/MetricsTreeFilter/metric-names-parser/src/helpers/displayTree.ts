import { type ArrayNode, type MetricNode } from '../parseMetricsList';

export function displayTree(node: MetricNode, tab = '') {
  for (const child of node.children.values()) {
    console.log(`${tab}${child.path}${child.part} (${child.count})`);

    if (child.children.size > 0) {
      displayTree(child, tab + '  ');
    }
  }
}

export function displayTreeArray(children: ArrayNode[], tab = '') {
  for (const child of children) {
    // console.log(`${tab}${child.path}${child.part} (${child.count})`);
    console.log(`${tab}\u001b[38;2;7m${child.path}\u001b[37m${child.part} (${child.count})`);

    if (child.children.length > 0) {
      displayTreeArray(child.children, tab + '  ');
    }
  }
}
