import { type ArrayNode } from '../parseMetricsList';

export function displayTreeArrayNode(treeArray: ArrayNode[], tab = '') {
  for (const node of treeArray) {
    console.log(`${tab}${node.prefix} (${node.count})`);
    displayTreeArrayNode(node.children, tab + '  ');
  }
}
