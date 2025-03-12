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
import { Button, IconButton, Spinner, useStyles2 } from '@grafana/ui';
import React, { useMemo, useState } from 'react';

import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { VAR_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';

import { parseMetricsList, type ArrayNode } from './metric-names-parser/src/parseMetricsList';
import { MetricTreeNode } from './MetricTreeNode';

// Define the MetricsTreeFilterState interface
interface MetricsTreeFilterState extends SceneObjectState {
  body?: SceneObjectBase;
  metrics: string[]; // List of all metric names
  loading?: boolean;
}

export type ExtraMetricsTreeFilterProps = {
  onClickCancel: () => void;
  onClickApply: (selectedNodeIds: string[]) => void;
};

export class MetricsTreeFilter extends SceneObjectBase<MetricsTreeFilterState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: (variable) => {
      const { name, options } = (variable as MultiValueVariable).state;

      if (name === VAR_METRICS_VARIABLE) {
        this.setState({ metrics: options.map((o) => o.value as string) });
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

    this.setState({
      metrics: filteredMetricsVariable.state.options.map((o) => o.value as string),
    });
  }

  public static Component = ({
    model,
    onClickCancel,
    onClickApply,
  }: SceneComponentProps<MetricsTreeFilter> & ExtraMetricsTreeFilterProps) => {
    const styles = useStyles2(getStyles);
    const { metrics, loading } = model.useState();
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [selectedMetricsCount, setSelectedMetricsCount] = useState<number>(0);

    const metricTreeRoot = useMemo(() => parseMetricsList(metrics).tree, [metrics]);

    if (loading) {
      return <Spinner inline />;
    }

    function toggleSubTree(node: ArrayNode, newIds: string[], select: boolean): string[] {
      if (select) {
        newIds.push(node.id);
        for (const child of node.children) {
          toggleSubTree(child, newIds, select);
        }
        return newIds;
      }

      newIds = newIds.filter((id) => id !== node.id);
      for (const child of node.children) {
        newIds = toggleSubTree(child, newIds, select);
      }
      return newIds;
    }

    return (
      <div className={styles.container}>
        <p>Select the parts of the metric name you want to filter by</p>
        <div className={styles.filtersContainer}>
          <p>&nbsp;</p>
          <div className={styles.section}>
            <div className={styles.tableHeader}>
              <div>
                n {selectedMetricsCount === 1 ? 'metric' : 'metrics'} selected&nbsp;
                <IconButton
                  name="times"
                  arial-label="Clear selection"
                  tooltip="Clear selection"
                  tooltipPlacement="top"
                  disabled={!selectedNodeIds.length}
                  onClick={() => setSelectedNodeIds([])}
                />
              </div>
              <div>
                <Button variant="primary" size="sm" onClick={() => onClickApply(selectedNodeIds)}>
                  Apply
                </Button>
                &nbsp;
                <Button variant="secondary" fill="text" size="sm" onClick={() => onClickCancel()}>
                  Cancel
                </Button>
              </div>
            </div>
            <div className={styles.body}>
              {metricTreeRoot?.map((node, index) => (
                <MetricTreeNode
                  key={node.id}
                  node={node}
                  selectedNodeIds={selectedNodeIds}
                  isLastChild={!metricTreeRoot ? true : index === metricTreeRoot.length - 1}
                  onToggleCheckbox={(node) => {
                    if (selectedNodeIds.includes(node.id)) {
                      setSelectedNodeIds(toggleSubTree(node, [...selectedNodeIds], false));
                      setSelectedMetricsCount(selectedMetricsCount - node.count);
                    } else {
                      setSelectedNodeIds(toggleSubTree(node, [...selectedNodeIds], true));
                      setSelectedMetricsCount(selectedMetricsCount + node.count);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      width: 460px;
      min-height: 520px;
      padding: ${theme.spacing(2)};
      background-color: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
    `,
    filtersContainer: css`
      display: flex;
      flex-direction: column;
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 100%;
    `,
    section: css`
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      margin: ${theme.spacing(2)};
      min-height: 0;
    `,
    tableHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: '16px',
      color: theme.colors.text.secondary,
      margin: `${theme.spacing(2)} 0 ${theme.spacing(0.5)} 0`,
      padding: `${theme.spacing(2)}`,
    }),
    body: css`
      flex-grow: 1;
      overflow: auto;
      min-height: 0;
      padding: ${theme.spacing(2)};
      border-top: 1px solid ${theme.colors.border.weak};
    `,
  };
}
