import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type MultiValueVariable,
  type SceneComponentProps,
  type SceneObjectState,
  type VariableValueOption,
} from '@grafana/scenes';
import { Button, IconButton, Spinner, useStyles2 } from '@grafana/ui';
import React, { useMemo, useState } from 'react';

import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { VAR_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';

import { isRecordingRule, parseMetricsList, type ArrayNode } from './metric-names-parser/src/parseMetricsList';
import { MetricTreeNode } from './MetricTreeNode';

// Define the MetricsTreeFilterState interface
interface MetricsTreeFilterState extends SceneObjectState {
  body?: SceneObjectBase;
  metrics: string[]; // List of all metric names
  loading?: boolean;
  recordingRulesOnly?: boolean;
}

export interface MetricsTreeFilterProps extends SceneComponentProps<MetricsTreeFilter> {
  onClickCancel: () => void;
  onClickApply: (selectedNodeIds: string[]) => void;
}

export class MetricsTreeFilter extends SceneObjectBase<MetricsTreeFilterState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: (variable) => {
      const { name, options } = (variable as MultiValueVariable).state;

      if (name === VAR_METRICS_VARIABLE) {
        this.updateMetricsFromOptions(options);
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

    this.updateMetricsFromOptions(filteredMetricsVariable.state.options);
  }

  private updateMetricsFromOptions(options: VariableValueOption[]) {
    const metrics = options.map((o) => o.value as string);
    this.setState({
      metrics: this.state.recordingRulesOnly ? metrics.filter(isRecordingRule) : metrics,
    });
  }

  public static Component = ({ model, onClickCancel, onClickApply }: MetricsTreeFilterProps) => {
    const styles = useStyles2(getStyles);
    const { metrics, loading, recordingRulesOnly } = model.useState();
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [selectedMetricsCount, setSelectedMetricsCount] = useState<number>(0);

    const metricTreeArray = useMemo(
      () => parseMetricsList(metrics, { convertToArray: true }) as ArrayNode[],
      [metrics]
    );

    if (loading) {
      return <Spinner inline />;
    }

    function toggleSubTree(node: ArrayNode, newIds: string[], select: boolean): string[] {
      if (select) {
        newIds.push(node.path);
        for (const child of node.children) {
          toggleSubTree(child, newIds, select);
        }
        return newIds;
      }

      newIds = newIds.filter((id) => id !== node.path);
      for (const child of node.children) {
        newIds = toggleSubTree(child, newIds, select);
      }
      return newIds;
    }

    return (
      <div className={styles.container}>
        <p>
          {recordingRulesOnly
            ? 'Select the parts of the recording rule you want to filter by'
            : 'Select the parts of the metric you want to filter by'}
        </p>
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
            {metricTreeArray.map((node, index) => (
              <MetricTreeNode
                key={node.path}
                node={node}
                selectedNodeIds={selectedNodeIds}
                isLastChild={index === metricTreeArray.length - 1}
                onToggleCheckbox={(node) => {
                  if (selectedNodeIds.includes(node.path)) {
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
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      padding: ${theme.spacing(2)};
      background-color: ${theme.colors.background.primary};
      border: 2px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
      position: relative;
    `,
    section: css`
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      min-height: 0;
      width: fit-content;
      min-width: 100%;
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
      display: inline-block;
      flex-grow: 1;
      min-width: 100%;
      min-height: 0;
      max-height: 360px;
      overflow-y: auto;
      padding: ${theme.spacing(2)};
      border-top: 1px solid ${theme.colors.border.weak};
    `,
  };
}
