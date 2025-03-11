import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  SceneReactObject,
  VariableDependencyConfig,
  type AdHocFiltersVariable,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { Button, CollapsableSection, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom-v5-compat';

import { WithUsageDataPreviewPanel } from 'MetricSelect/WithUsageDataPreviewPanel';
import { VAR_FILTERS } from 'shared';
import { getColorByIndex } from 'utils';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'WingmanDataTrail/HeaderControls/LayoutSwitcher';
import { GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS } from 'WingmanDataTrail/MetricsList/SimpleMetricsList';
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

    this.subscribeToLayoutChange();
  }

  private subscribeToLayoutChange() {
    const layoutSwitcher = sceneGraph.findByKeyAndType(this, 'layout-switcher', LayoutSwitcher);

    const onChangeState = (newState: LayoutSwitcherState, prevState?: LayoutSwitcherState) => {
      if (newState.layout !== prevState?.layout) {
        (this.state.body as SceneCSSGridLayout).setState({
          templateColumns: newState.layout === LayoutType.ROWS ? GRID_TEMPLATE_ROWS : GRID_TEMPLATE_COLUMNS,
        });
      }
    };

    onChangeState(layoutSwitcher.state); // ensure layout when landing on the page

    this._subs.add(layoutSwitcher.subscribeToState(onChangeState));
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

    const panelList = metricsList.slice(0, listLength);

    const panels = panelList.map((metricName, colorIndex) => this.buildPanel(metricName, colorIndex));
    const autoRows = panels.length ? '240px' : 'auto';

    if (!panels.length) {
      panels.push(
        new SceneCSSGridItem({
          body: new SceneReactObject({
            reactNode: <em>No results.</em>,
          }),
        })
      );
    }

    return new SceneCSSGridLayout({
      key: `${labelName}-${labelValue}-metrics-${visibleMetricsCount}`, // Add a different key to force re-render
      templateColumns: GRID_TEMPLATE_COLUMNS,
      autoRows,
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

    const location = useLocation();
    const navigate = useNavigate();

    const isOnboardingView = location.pathname.includes('/onboard');

    const onClickFilterBy = () => {
      const adHocFiltersVariable = sceneGraph.lookupVariable(VAR_FILTERS, model) as AdHocFiltersVariable;

      adHocFiltersVariable.setState({
        filters: [...adHocFiltersVariable.state.filters, { key: labelName, operator: '=', value: labelValue }],
      });

      navigate({
        pathname: location.pathname.replace('/onboard-wingman', '/trail-wingman'),
      });
    };

    return (
      <div className={styles.rowContainer}>
        {/* for a custom label with buttons on the right, had to hack this above the collapsable section */}
        <div className={styles.container}>
          <span className={styles.groupName}>{`${labelName}: ${labelValue}`}</span>
          <div className={styles.buttons}>
            {!isOnboardingView && (
              <Button variant="secondary" fill="outline" className={styles.button}>
                Exclude
              </Button>
            )}
            {isOnboardingView && (
              <Button variant="secondary" fill="outline" className={styles.button} onClick={onClickFilterBy}>
                Filter by
              </Button>
            )}
          </div>
        </div>

        <CollapsableSection onToggle={() => setIsCollapsed(!isCollapsed)} label="" isOpen={!isCollapsed}>
          {body && <body.Component model={body} />}

          {/* Show toggle button if there are more metrics to show */}
          {showPagination && showMoreCount > 0 && (
            <div className={styles.showMoreButton}>
              <Button variant="secondary" fill="outline" onClick={handleToggleShowMore}>
                Show {showMoreCount} More ({currentCount}/{metricsList.length})
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
      zIndex: 100,
    }),
    showMoreButton: css({
      display: 'flex',
      marginTop: '16px',
      justifyContent: 'center',
    }),
    button: css({}),
  };
}
