import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type MultiValueVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Checkbox, IconButton, Spinner, Tag, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';

import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { VAR_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';

// Define the structure for a metric node in the tree
interface MetricNode {
  name: string;
  count: number;
  children?: MetricNode[];
}

// Define the MetricsTreeFilterState interface
interface MetricsTreeFilterState extends SceneObjectState {
  body?: SceneObjectBase;
  metrics: string[]; // List of all metric names
  metricTree: MetricNode[]; // Hierarchical structure of metrics
  loading?: boolean;
}

export class MetricsTreeFilter extends SceneObjectBase<MetricsTreeFilterState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: (variable) => {
      const { name, options } = (variable as MultiValueVariable).state;

      if (name === VAR_METRICS_VARIABLE) {
        this.setState({ metrics: options.map((o) => o.value as string) });
        this.buildMetricTree();
        return;
      }

      if (name === VAR_FILTERED_METRICS_VARIABLE) {
        // this.updateCounts(options as MetricOptions);
        return;
      }
    },
  });

  constructor(state: Partial<MetricsTreeFilterState>) {
    super({
      ...state,
      key: 'MetricsTreeFilter',
      body: undefined,
      loading: false,
      metrics: [],
      metricTree: [],
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const filteredMetricsVariable = sceneGraph.lookupVariable(
      VAR_FILTERED_METRICS_VARIABLE,
      this
    ) as FilteredMetricsVariable;

    this._subs.add(
      filteredMetricsVariable.subscribeToState((newState, prevState) => {
        if (!prevState.loading && newState.loading) {
          this.setState({ loading: true });
        } else if (prevState.loading && !newState.loading) {
          this.setState({ loading: false });
        }
      })
    );

    this.setState({ metrics: filteredMetricsVariable.state.options.map((o) => o.value as string) });

    this.buildMetricTree();
  }

  // Method to transform flat list of metrics into hierarchical tree structure
  private buildMetricTree() {
    const { metrics } = this.state;
    if (!metrics || metrics.length === 0) {
      return;
    }

    // Create a map for grouping metrics by prefix
    const prefixMap = new Map<string, string[]>();

    metrics.forEach((metric) => {
      // Extract prefix (everything before the first underscore or the whole string if no underscore)
      const prefixMatch = metric.match(/^([^_:]+)/);
      if (prefixMatch) {
        const prefix = prefixMatch[1];
        if (!prefixMap.has(prefix)) {
          prefixMap.set(prefix, []);
        }
        prefixMap.get(prefix)?.push(metric);
      }
    });

    // Convert map to array of MetricNode objects
    const metricTree: MetricNode[] = Array.from(prefixMap.entries())
      .map(([prefix, metricsList]) => {
        return this.buildMetricSubTree(prefix, metricsList);
      })
      .sort((a, b) => b.count - a.count);

    this.setState({ metricTree });
  }

  // Recursive function to build subtrees
  private buildMetricSubTree(prefix: string, metricsList: string[]): MetricNode {
    // Group child metrics
    const childrenMap = new Map<string, string[]>();

    metricsList.forEach((metric) => {
      // If the metric is exactly the prefix, add it to a special group
      if (metric === prefix) {
        if (!childrenMap.has(prefix)) {
          childrenMap.set(prefix, []);
        }
        childrenMap.get(prefix)?.push(metric);
        return;
      }

      // Extract the rest of the metric name after the prefix
      const restOfMetric = metric.substring(prefix.length + 1); // +1 for the underscore
      if (!restOfMetric) {
        return;
      }

      // Extract the next segment (up to the next underscore or end of string)
      const nextSegmentMatch = restOfMetric.match(/^([^_:]+)/);
      if (nextSegmentMatch) {
        const nextSegment = `${prefix}_${nextSegmentMatch[1]}`;
        if (!childrenMap.has(nextSegment)) {
          childrenMap.set(nextSegment, []);
        }
        childrenMap.get(nextSegment)?.push(metric);
      }
    });

    // Create children nodes recursively
    const children = Array.from(childrenMap.entries()).map(([childPrefix, childMetrics]) => {
      // If all metrics in this child are exactly the same as the childPrefix or there's only one metric,
      // don't recurse further
      if (childMetrics.every((m) => m === childPrefix) || childMetrics.length === 1) {
        return {
          name: childPrefix,
          count: childMetrics.length,
        };
      }

      // Otherwise, recursively build the subtree
      return this.buildMetricSubTree(childPrefix, childMetrics);
    });

    return {
      name: prefix,
      count: metricsList.length,
      children: children.length > 0 ? children : undefined,
    };
  }

  public static Component = ({ model }: SceneComponentProps<MetricsTreeFilter>) => {
    const styles = useStyles2(getStyles);
    const { metricTree, loading } = model.useState();

    if (loading) {
      return <Spinner inline />;
    }

    return (
      <div className={styles.container}>
        <div className={styles.treeContainer}>
          {metricTree.map((node, index) => (
            <MetricTreeNode
              key={node.name}
              node={node}
              parentName={undefined}
              isLastChild={index === metricTree.length - 1}
              level={0}
            />
          ))}
        </div>
      </div>
    );
  };
}

// Component for rendering a single tree node
const MetricTreeNode = ({
  node,
  parentName,
  isLastChild = false,
  isChild = false,
  level = 0,
}: {
  node: MetricNode;
  parentName?: string;
  isLastChild?: boolean;
  isChild?: boolean;
  level?: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const styles = useStyles2(getStyles);

  // Toggle expanded state
  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  // Split the node name into prefix and suffix parts if this is a child node
  let prefixPart: string | undefined;
  let suffixPart = node.name;

  if (parentName && node.name.startsWith(parentName)) {
    prefixPart = parentName;
    suffixPart = node.name.substring(parentName.length);
  }

  // Apply appropriate styling for the tree structure
  const nodeStyle = {
    marginLeft: isChild ? '0' : '0',
    position: 'relative' as const,
  };

  // For nodes that are children but have their own children, we need to add a special class
  const nodeContainerClass = isChild ? styles.nodeContainer : '';

  return (
    <div className={nodeContainerClass} style={nodeStyle}>
      <div className={`${styles.nodeRow} ${isChild ? styles.childNodeRow : ''}`}>
        <div className={styles.iconContainer}>
          {node.children && node.children.length > 0 ? (
            <IconButton
              className={styles.expandIcon}
              name={expanded ? 'minus-circle' : 'plus-circle'}
              onClick={toggleExpand}
              tooltip={expanded ? 'Collapse' : 'Expand'}
            />
          ) : null}
        </div>
        <div className={styles.labelContainer}>
          <div className={styles.checkbox}>
            <Checkbox label="" />
          </div>
          <span className={styles.nodeName}>
            {prefixPart && <span className={styles.prefixPart}>{prefixPart}</span>}
            {suffixPart}
          </span>
          <Tag className={styles.badge} name={node.count.toString()} colorIndex={9} />
        </div>
      </div>

      {/* Render children if expanded */}
      {expanded && node.children && (
        <div className={`${styles.childrenContainer} ${isLastChild ? styles.lastChild : ''}`}>
          {node.children.map((child, index) => (
            <MetricTreeNode
              key={child.name}
              node={child}
              parentName={node.name}
              isLastChild={index === node.children!.length - 1}
              isChild={true}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  const treeBorderColor = theme.colors.border.medium;

  return {
    container: css`
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 300px;
      overflow: auto;
      padding: ${theme.spacing(1)};
    `,
    treeContainer: css`
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: ${theme.spacing(0.5)};
    `,
    nodeContainer: css`
      display: flex;
      flex-direction: column;
      width: 100%;
      position: relative;
    `,
    nodeRow: css`
      display: flex;
      align-items: center;
      width: 100%;
      padding: ${theme.spacing(0.5)} 0;
      cursor: pointer;
      border-radius: ${theme.shape.radius.default};
      position: relative;
      &:hover {
        background: ${theme.colors.background.secondary};
      }
    `,
    childNodeRow: css`
      &:before {
        content: '';
        position: absolute;
        top: 50%;
        left: -${theme.spacing(2)};
        width: ${theme.spacing(2)};
        height: 1px;
        background-color: ${treeBorderColor};
        z-index: 0;
      }
    `,
    iconContainer: css`
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 28px;
      min-width: 28px;
      height: 24px;
      margin-right: ${theme.spacing(1)};
      z-index: 1;
    `,
    checkbox: css`
      margin-right: ${theme.spacing(1)};
    `,
    labelContainer: css`
      display: flex;
      flex-grow: 1;
      min-width: 0; /* Prevents content from overflowing */
      overflow: hidden;
    `,
    expandIcon: css`
      flex-shrink: 0;
    `,
    nodeName: css`
      font-weight: ${theme.typography.fontWeightMedium};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `,
    prefixPart: css`
      color: ${theme.colors.text.secondary};
    `,
    badge: css`
      margin-left: ${theme.spacing(2)};
      border-radius: 11px;
      padding: 2px ${theme.spacing(1.5)};
      color: ${theme.colors.text.primary};
      background-color: ${theme.colors.background.secondary};
      flex-shrink: 0;
    `,
    childrenContainer: css`
      position: relative;
      padding-left: ${theme.spacing(4)};
      width: 100%;

      /* Vertical line along children */
      &:before {
        content: '';
        position: absolute;
        top: 0;
        left: 14px; /* Align with the center of the icon container */
        width: 1px;
        height: 100%;
        background-color: ${treeBorderColor};
        z-index: 0;
      }
    `,
    lastChild: css`
      /* For the last child, only show vertical line halfway down */
      &:before {
        height: 14px;
      }
    `,
  };
}
