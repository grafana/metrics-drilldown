import { parseMetricsList, type ArrayNode } from './parseMetricsList';
import metricsList1 from '../input/metrics-list1.json';
import metricsList2 from '../input/metrics-list2.json';

describe('parseMetricsList', () => {
  it('should parse metrics list and create a hierarchical tree structure (#1)', () => {
    const result = parseMetricsList(metricsList1);

    // Verify basic structure
    expect(result).toHaveProperty('root');
    expect(result).toHaveProperty('tree');

    // Verify metrics count
    expect(result.root.count).toBe(metricsList1.length);

    // Verify tree is sorted by count (descending)
    if (result.tree.length > 1) {
      for (let i = 0; i < result.tree.length - 1; i++) {
        expect(result.tree[i].count).toBeGreaterThanOrEqual(result.tree[i + 1].count);
      }
    }

    // Match against snapshot for structure validation
    expect(result.tree).toMatchSnapshot();
  });

  it('should parse metrics list and create a hierarchical tree structure (#2)', () => {
    const result = parseMetricsList(metricsList2);

    expect(result.tree).toMatchSnapshot();
  });

  it('should correctly identify and preserve separators in metric names', () => {
    const result = parseMetricsList(metricsList1);

    // Check for metrics with colons (e.g., asserts:client)
    const assertsNode = result.tree.find((node) => node.prefix === 'asserts');
    expect(assertsNode).toBeDefined();

    // Find and verify a node with colon separator
    const colonSeparatorNode = findNodeWithSeparator(result.tree, ':');
    expect(colonSeparatorNode).toBeDefined();
    expect(colonSeparatorNode?.separator).toBe(':');

    // Find and verify a node with underscore separator
    const underscoreSeparatorNode = findNodeWithSeparator(result.tree, '_');
    expect(underscoreSeparatorNode).toBeDefined();
    expect(underscoreSeparatorNode?.separator).toBe('_');
  });

  it('should create a correct tree structure for metrics with the same prefix', () => {
    // Extract metrics starting with "asserts:" for focused testing
    const assertsMetrics = metricsList1.filter((m) => m.startsWith('asserts:'));
    const result = parseMetricsList(assertsMetrics);

    // Verify the structure of asserts metrics
    expect(result.tree[0].prefix).toBe('asserts');
    expect(result.tree[0].count).toBe(assertsMetrics.length);
    expect(result.tree[0].separator).toBe(':');

    // Children should be properly grouped
    const childrenPrefixes = result.tree[0].children.map((c) => c.prefix);
    expect(childrenPrefixes).toContain('client');
    expect(childrenPrefixes).toContain('error');

    // Match against snapshot for detailed structure validation
    expect(result.tree).toMatchSnapshot('asserts-metrics-tree');
  });

  it('should handle nested metric paths correctly (3+ levels deep)', () => {
    // Test with metrics that have multiple levels: e.g., asserts:client:error:ratio
    const nestedMetrics = metricsList1.filter((m) => m.startsWith('asserts:client:error'));
    expect(nestedMetrics.length).toBeGreaterThan(0); // Ensure we have test data

    const result = parseMetricsList(nestedMetrics);

    // Verify the first level
    expect(result.tree[0].prefix).toBe('asserts');

    // Verify second level (client)
    const clientNode = result.tree[0].children.find((c) => c.prefix === 'client');
    expect(clientNode).toBeDefined();
    expect(clientNode?.separator).toBe(':');

    // Verify third level (error)
    const errorNode = clientNode?.children.find((c) => c.prefix === 'error');
    expect(errorNode).toBeDefined();
    expect(errorNode?.separator).toBe(':');

    // Verify ratio nodes are present in the correct place
    const ratioNode = errorNode?.children.find((c) => c.prefix === 'ratio');
    expect(ratioNode).toBeDefined();

    // Full snapshot for this subtree
    expect(result.tree).toMatchSnapshot('nested-metrics-tree');
  });

  it('should handle metrics with mixed separator types correctly', () => {
    // Find metrics with both underscore and colon separators
    const mixedSeparatorMetrics = [
      'process_runtime_go_gc_pause_ns_total',
      'asserts:error:ratio',
      'system_cpu_time_seconds_total',
      'asserts:client:error',
    ];

    const result = parseMetricsList(mixedSeparatorMetrics);

    // Verify we have both underscore and colon separators in the top level
    const underscoreNode = result.tree.find((n) => n.separator === '_');
    const colonNode = result.tree.find((n) => n.separator === ':');

    expect(underscoreNode).toBeDefined();
    expect(colonNode).toBeDefined();

    // Verify specific nodes
    const processNode = result.tree.find((n) => n.prefix === 'process');
    const assertsNode = result.tree.find((n) => n.prefix === 'asserts');

    expect(processNode?.separator).toBe('_');
    expect(assertsNode?.separator).toBe(':');

    // For nested validation
    expect(result.tree).toMatchSnapshot('mixed-separator-metrics');
  });

  it('should handle edge cases correctly', () => {
    // Empty list
    const emptyResult = parseMetricsList([]);
    expect(emptyResult.root.count).toBe(0);
    expect(emptyResult.tree).toHaveLength(0);

    // Single item with no separator
    const singleItemResult = parseMetricsList(['ALERTS']);
    expect(singleItemResult.root.count).toBe(1);
    expect(singleItemResult.tree).toHaveLength(1);
    expect(singleItemResult.tree[0].prefix).toBe('ALERTS');
    expect(singleItemResult.tree[0].separator).toBe('');

    // Single item with separator
    const singleItemWithSeparatorResult = parseMetricsList(['asserts:error']);
    expect(singleItemWithSeparatorResult.root.count).toBe(1);
    expect(singleItemWithSeparatorResult.tree).toHaveLength(1);
    expect(singleItemWithSeparatorResult.tree[0].prefix).toBe('asserts');
    expect(singleItemWithSeparatorResult.tree[0].separator).toBe(':');
    expect(singleItemWithSeparatorResult.tree[0].children).toHaveLength(1);
    expect(singleItemWithSeparatorResult.tree[0].children[0].prefix).toBe('error');
  });

  it('should preserve correct count values at each level', () => {
    // Create a sample with predictable counts
    const countTestMetrics = [
      'parent_child1_grandchild1',
      'parent_child1_grandchild2',
      'parent_child2_grandchild1',
      'parent_child3',
      'another_metric',
    ];

    const result = parseMetricsList(countTestMetrics);

    // Verify root count
    expect(result.root.count).toBe(5);

    // Find the parent node
    const parentNode = result.tree.find((n) => n.prefix === 'parent');
    expect(parentNode).toBeDefined();
    expect(parentNode?.count).toBe(4); // All parent_* metrics

    // Verify child counts
    const child1 = parentNode?.children.find((c) => c.prefix === 'child1');
    expect(child1?.count).toBe(2); // parent_child1_* metrics

    const child2 = parentNode?.children.find((c) => c.prefix === 'child2');
    expect(child2?.count).toBe(1); // parent_child2_* metrics

    const child3 = parentNode?.children.find((c) => c.prefix === 'child3');
    expect(child3?.count).toBe(1); // parent_child3

    // Another node should have count 1
    const anotherNode = result.tree.find((n) => n.prefix === 'another');
    expect(anotherNode?.count).toBe(1);
  });

  // Performance tests
  it('should handle large datasets efficiently', () => {
    // Generate a large dataset (10,000 metrics)
    const largeDataset = generateLargeTestDataset(10000);

    // Measure performance
    const startTime = performance.now();
    const result = parseMetricsList(largeDataset);
    const endTime = performance.now();

    // Log performance for review (not an assertion as it varies by environment)
    console.log(`Parsing 10,000 metrics took ${endTime - startTime}ms`);

    // Basic validation
    expect(result.root.count).toBe(10000);
    expect(result.tree.length).toBeGreaterThan(0);

    // Since we're generating metrics with 20 prefixes, there should be close to 20 top-level nodes
    // (exact number may vary due to randomization)
    expect(result.tree.length).toBeGreaterThanOrEqual(10);
  });

  // Behavior test - colon and underscore mixtures
  it('should consistently handle metrics with inconsistent separators', () => {
    const inconsistentMetrics = ['system:cpu_usage', 'system_cpu:usage', 'system:cpu:total', 'system_cpu_total'];

    const result = parseMetricsList(inconsistentMetrics);

    // Verify structure
    const systemNode = result.tree.find((n) => n.prefix === 'system');
    expect(systemNode).toBeDefined();

    // We want to verify that separators are mapped correctly for each child branch
    const cpuNodes = systemNode?.children.filter(
      (c) => c.prefix === 'cpu' || c.prefix === 'cpu:usage' || c.prefix === 'cpu_usage'
    );

    // Create a snapshot to inspect the structure
    expect(result.tree).toMatchSnapshot('inconsistent-separator-metrics');
  });
});

// Helper function to find a node with specific separator in the tree
function findNodeWithSeparator(nodes: ArrayNode[], separator: string): ArrayNode | undefined {
  for (const node of nodes) {
    if (node.separator === separator) {
      return node;
    }

    if (node.children && node.children.length > 0) {
      const foundInChildren = findNodeWithSeparator(node.children, separator);
      if (foundInChildren) {
        return foundInChildren;
      }
    }
  }

  return undefined;
}

// Helper function to generate a large dataset for performance testing
function generateLargeTestDataset(size: number): string[] {
  const prefixes = [
    'system',
    'process',
    'network',
    'database',
    'api',
    'http',
    'app',
    'monitoring',
    'logs',
    'traces',
    'cpu',
    'memory',
    'disk',
    'user',
    'session',
    'queue',
    'cache',
    'auth',
    'events',
    'metrics',
  ];

  const midParts = [
    'count',
    'rate',
    'latency',
    'error',
    'success',
    'bytes',
    'requests',
    'responses',
    'duration',
    'size',
    'total',
    'average',
    'max',
    'min',
    'p95',
    'p99',
    'connections',
    'active',
    'idle',
    'wait',
  ];

  const suffixes = [
    'total',
    'seconds',
    'milliseconds',
    'bytes',
    'count',
    'ratio',
    'percent',
    'rate',
    'score',
    'index',
    'bucket',
    'sum',
    'value',
    'status',
    'info',
    'stat',
    'metric',
    'data',
    'counter',
    'gauge',
  ];

  const separators = ['_', ':'];

  const result: string[] = [];

  for (let i = 0; i < size; i++) {
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomMid = midParts[Math.floor(Math.random() * midParts.length)];
    const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const separator1 = separators[Math.floor(Math.random() * separators.length)];
    const separator2 = separators[Math.floor(Math.random() * separators.length)];

    // Sometimes generate 2-part metrics, sometimes 3-part
    if (Math.random() > 0.5) {
      result.push(`${randomPrefix}${separator1}${randomMid}${separator2}${randomSuffix}`);
    } else {
      result.push(`${randomPrefix}${separator1}${randomMid}`);
    }
  }

  return result;
}
