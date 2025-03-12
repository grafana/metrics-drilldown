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
import { IconButton, Input, Spinner, useStyles2 } from '@grafana/ui';
import React from 'react';

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
  metricTreeRoot?: ArrayNode[]; // Hierarchical structure of metrics
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
      metricTreeRoot: undefined,
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

  private buildMetricTree() {
    const { metrics } = this.state;
    const { tree } = parseMetricsList(metrics);
    this.setState({ metricTreeRoot: tree });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsTreeFilter>) => {
    const styles = useStyles2(getStyles);
    const { metricTreeRoot, loading } = model.useState();

    if (loading) {
      return <Spinner inline />;
    }

    return (
      <>
        <Input
          placeholder="Quick search..."
          prefix={<i className="fa fa-search" />}
          suffix={
            <>
              <IconButton name="times" variant="secondary" tooltip="Clear search" />
            </>
          }
        />
        <div className={styles.container}>
          <div className={styles.treeContainer}>
            {metricTreeRoot?.map((node, index) => (
              <MetricTreeNode
                key={node.prefix}
                node={node}
                isLastChild={!metricTreeRoot ? true : index === metricTreeRoot.length - 1}
              />
            ))}
          </div>
        </div>
      </>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
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
  };
}
