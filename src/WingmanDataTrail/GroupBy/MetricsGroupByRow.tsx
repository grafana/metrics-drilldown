import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { Button, CollapsableSection, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';

import { WithUsageDataPreviewPanel } from 'MetricSelect/WithUsageDataPreviewPanel';
import { getColorByIndex } from 'utils';
import { GRID_TEMPLATE_COLUMNS } from 'WingmanDataTrail/MetricsList/SimpleMetricsList';
import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { MetricVizPanel } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';

// Add new component interface
interface MetricsGroupByRowState extends SceneObjectState {
  labelName: string;
  labelValue: string;
  metricsList: string[];
  body?: SceneObject;
  visibleMetricsCount?: number;
  paginationCount?: number;
}

export class MetricsGroupByRow extends SceneObjectBase<MetricsGroupByRowState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERED_METRICS_VARIABLE],
    onVariableUpdateCompleted: () => {
      const filteredMetricsVariable = sceneGraph.lookupVariable(
        VAR_FILTERED_METRICS_VARIABLE,
        this
      ) as FilteredMetricsVariable;

      const metricsList = filteredMetricsVariable.state.options.map((option) => option.value as string);

      this.setState({
        metricsList,
        body: this.buildMetricsBody(metricsList),
      });
    },
  });

  public constructor(state: Partial<MetricsGroupByRowState>) {
    super({
      ...state,
      key: `${state.labelName || ''}-${state.labelValue || ''}`,
      labelName: state.labelName || '',
      labelValue: state.labelValue || '',
      metricsList: [],
      body: undefined,
      visibleMetricsCount: state.visibleMetricsCount || 6,
      paginationCount: state.paginationCount || 9,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const filteredMetricsVariable = sceneGraph.lookupVariable(
      VAR_FILTERED_METRICS_VARIABLE,
      this
    ) as FilteredMetricsVariable;

    const metricsList = filteredMetricsVariable.state.options.map((option) => option.value as string);

    this.setState({
      metricsList,
      body: this.buildMetricsBody(metricsList),
    });
  }

  /**
   * Builds a panel for a metric with usage stats
   * @param metricName
   * @param colorIndex
   * @returns
   */
  private buildPanel(metricName: string, colorIndex: number) {
    const { labelName, labelValue } = this.state;

    return new SceneCSSGridItem({
      body: new WithUsageDataPreviewPanel({
        vizPanelInGridItem: new MetricVizPanel({
          metricName,
          color: getColorByIndex(colorIndex),
          matchers: [`${labelName}="${labelValue}"`],
          groupByLabel: undefined,
        }),
        metric: metricName,
      }),
    });
  }

  private buildMetricsBody(metricsList: string[]): SceneObject {
    const { labelName, labelValue, visibleMetricsCount } = this.state;

    const listLength =
      visibleMetricsCount && metricsList.length >= visibleMetricsCount ? visibleMetricsCount : metricsList.length;

    let colorIndex = 0;

    const panelList = metricsList.slice(0, listLength);

    // TODO: remove from list if no data?
    const panels = panelList.map((metricName) => this.buildPanel(metricName, colorIndex++));

    return new SceneCSSGridLayout({
      key: `${labelName}-${labelValue}-metrics-${visibleMetricsCount}`, // Add a different key to force re-render
      templateColumns: GRID_TEMPLATE_COLUMNS,
      autoRows: '240px', // will need to fix this at some point
      alignItems: 'start',
      isLazy: true,
      children: panels,
    });
  }

  /**
   * Adds more metric panels to the existing body
   * @param currentCount Current number of visible metrics
   * @param newCount New number of visible metrics
   */
  private addMetricPanels(currentCount: number, newCount: number) {
    const { metricsList } = this.state;

    // Get the SceneCSSGridLayout body
    const gridLayout = this.state.body as SceneCSSGridLayout;
    if (!gridLayout) {
      return;
    }

    // Get current children array
    const currentChildren = [...gridLayout.state.children];

    // Calculate color index to start from (continue from where we left off)
    let colorIndex = currentCount;

    // Create new panels for the additional metrics
    const newPanels = metricsList
      .slice(currentCount, newCount)
      .map((metricName) => this.buildPanel(metricName, colorIndex++));

    // Add new panels to the existing children
    const updatedChildren = [...currentChildren, ...newPanels];

    // Update the body's children state
    gridLayout.setState({
      children: updatedChildren,
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsGroupByRow>) => {
    const styles = useStyles2(getStyles);

    const { labelName, labelValue, body, metricsList, visibleMetricsCount, paginationCount } = model.useState();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [currentCount, setCurrentCount] = useState(visibleMetricsCount ?? 6);
    const [showPagination, setShowPagination] = useState((visibleMetricsCount ?? 6) < metricsList.length);

    const handleToggleShowMore = () => {
      // Calculate new visible count (current + pagination count, but not exceeding metricsList length)
      const newCount = Math.min(currentCount + (paginationCount ?? 9), metricsList.length);

      // Add new panels to the existing body
      model.addMetricPanels(currentCount, newCount);

      // Update current count
      setCurrentCount(newCount);

      // Hide pagination button if all metrics are now visible
      if (newCount >= metricsList.length) {
        setShowPagination(false);
      }
    };

    const showMoreCount = Math.min(paginationCount ?? 9, metricsList.length - currentCount);

    return (
      <div className={styles.rowContainer}>
        {/* for a custom label with buttons on the right, had to hack this above the collapsable section */}
        <div className={styles.container}>
          <span className={styles.groupName}>{`${labelName}: ${labelValue}`}</span>
          <div className={styles.buttons}>
            <Button variant="secondary" fill="outline" className={styles.button}>
              Exclude
            </Button>
          </div>
        </div>

        <CollapsableSection onToggle={() => setIsCollapsed(!isCollapsed)} label="" isOpen={!isCollapsed}>
          {body && <body.Component model={body} />}

          {/* Show toggle button if there are more metrics to show */}
          {showPagination && showMoreCount > 0 && (
            <div className={styles.showMoreButton}>
              <Button variant="secondary" fill="outline" onClick={handleToggleShowMore}>
                Show {showMoreCount} More ({currentCount}/{metricsList.length})&nbsp;
                <i className="fa fa-caret-down"></i>
              </Button>
            </div>
          )}
        </CollapsableSection>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    rowContainer: css({
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(2),
      background: theme.colors.background.primary,
      boxShadow: theme.shadows.z1,
      marginBottom: '16px',
    }),
    row: css({
      marginBottom: '32px',
    }),
    container: css({
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '98%',
      marginBottom: '-36px',
    }),
    groupName: css({
      fontSize: '18px',
    }),
    buttons: css({
      display: 'flex',
      gap: '8px',
      marginLeft: 'auto',
    }),
    showMoreButton: css({
      display: 'flex',
      marginTop: '16px',
    }),
    button: css({}),
  };
}
