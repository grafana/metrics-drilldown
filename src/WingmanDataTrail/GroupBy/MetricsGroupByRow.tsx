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
}

export class MetricsGroupByRow extends SceneObjectBase<MetricsGroupByRowState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERED_METRICS_VARIABLE],
    onVariableUpdateCompleted: () => {
      const filteredMetricsVariable = sceneGraph.lookupVariable(
        VAR_FILTERED_METRICS_VARIABLE,
        this
      ) as FilteredMetricsVariable;

      this.setState({
        metricsList: filteredMetricsVariable.state.options.map((option) => option.value as string),
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
      body: this.buildMetricsBody(metricsList, true),
      metricsList,
    });
  }

  /**
   * Builds a panel for a metric with usage stats
   * @param metricName
   * @param colorIndex
   * @returns
   */
  private buildPanel(metricName: string, colorIndex: number) {
    return new SceneCSSGridItem({
      body: new WithUsageDataPreviewPanel({
        vizPanelInGridItem: new MetricVizPanel({
          metricName,
          color: getColorByIndex(colorIndex++),
          groupByLabel: undefined,
        }),
        metric: metricName,
      }),
    });
  }

  private buildMetricsBody(metricsList: string[], limit?: boolean): SceneObject {
    const { labelName, labelValue } = this.state;

    const listLength = limit && metricsList.length >= 5 ? 5 : metricsList.length;

    let colorIndex = 0;

    const panelList = metricsList.slice(0, listLength);

    const panels = panelList.map((metricName) => this.buildPanel(metricName, colorIndex++));

    return new SceneCSSGridLayout({
      key: `${labelName}-${labelValue}-metrics-${limit ? 'limited' : 'all'}`, // Add a different key to force re-render
      templateColumns: GRID_TEMPLATE_COLUMNS,
      autoRows: '240px', // will need to fix this at some point
      alignItems: 'start',
      isLazy: true,
      children: panels,
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsGroupByRow>) => {
    const styles = useStyles2(getStyles);

    const { labelName, labelValue, body, metricsList } = model.state;
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showingMore, setShowingMore] = useState(false);

    const handleToggleShowMore = () => {
      setShowingMore(!showingMore);

      // Create a new body with the appropriate limit based on the new state
      const newBody = model.buildMetricsBody(metricsList, showingMore);
      model.setState({
        body: newBody,
      });
    };

    return (
      <div className={styles.rowContainer}>
        {/* for a custom label with buttons on the right, had to hack this above the collapsable section */}
        <div className={styles.container}>
          <span className={styles.groupName}>{`${labelName}: ${labelValue}`}</span>
          <div className={styles.buttons}>
            <Button variant="secondary" fill="outline" className={styles.button}>
              Include
            </Button>
            <Button variant="secondary" fill="outline" className={styles.button}>
              Exclude
            </Button>
          </div>
        </div>

        <CollapsableSection onToggle={() => setIsCollapsed(!isCollapsed)} label="" isOpen={!isCollapsed}>
          {body && <body.Component model={body} />}
          {/* Show toggle button if there are more than three metrics */}
          {metricsList.length > 3 && (
            <div className={styles.showMoreButton}>
              <button className="btn btn-sm btn-secondary" onClick={handleToggleShowMore}>
                {showingMore ? (
                  <>
                    Show Less&nbsp;<i className="fa fa-caret-up"></i>
                  </>
                ) : (
                  <>
                    Show 9 More (6/{metricsList.length})&nbsp;<i className="fa fa-caret-down"></i>
                  </>
                )}
              </button>
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
      marginBottom: '32px',
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
      fontSize: '22px',
    }),
    buttons: css({
      display: 'flex',
      gap: '8px',
      marginLeft: 'auto',
    }),
    showMoreButton: css({
      display: 'flex',
      justifyContent: 'center',
      marginTop: '8px',
    }),
    button: css({}),
  };
}
