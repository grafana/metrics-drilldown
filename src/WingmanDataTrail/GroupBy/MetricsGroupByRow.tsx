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
  type SceneObjectState,
} from '@grafana/scenes';
import { Button, CollapsableSection, Icon, Spinner, useStyles2 } from '@grafana/ui';
import { isEqual } from 'lodash';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom-v5-compat';

import { WithUsageDataPreviewPanel } from 'MetricSelect/WithUsageDataPreviewPanel';
import { VAR_FILTERS } from 'shared';
import { getColorByIndex } from 'utils';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'WingmanDataTrail/HeaderControls/LayoutSwitcher';
import { LabelsDataSource } from 'WingmanDataTrail/Labels/LabelsDataSource';
import { GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS } from 'WingmanDataTrail/MetricsList/SimpleMetricsList';
import { VAR_FILTERED_METRICS_VARIABLE } from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { SelectAction } from 'WingmanDataTrail/MetricVizPanel/actions/SelectAction';
import { MetricVizPanel } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';
import { VAR_VARIANT, type VariantVariable } from 'WingmanOnboarding/VariantVariable';
interface MetricsGroupByRowState extends SceneObjectState {
  index: number;
  labelName: string;
  labelValue: string;
  labelCardinality: number;
  metricsList: string[];
  body: SceneCSSGridLayout;
  loading: boolean;
  visibleMetricsCount: number;
  paginationCount: number;
}

const VISIBLE_METRICS_COUNT = 6;
const PAGINATION_COUNT = 9;
const GRID_AUTO_ROWS = '240px';

export class MetricsGroupByRow extends SceneObjectBase<MetricsGroupByRowState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERED_METRICS_VARIABLE],
    onVariableUpdateCompleted: async () => {
      const metricsList = await this.fetchMetricsList();

      if (!isEqual(this.state.metricsList, metricsList)) {
        this.setState({ metricsList });
        this.updateBodyChildren();
      }
    },
  });

  public constructor(state: {
    index: MetricsGroupByRowState['index'];
    labelName: MetricsGroupByRowState['labelName'];
    labelValue: MetricsGroupByRowState['labelValue'];
    labelCardinality: MetricsGroupByRowState['labelCardinality'];
  }) {
    super({
      ...state,
      key: `${state.labelName || ''}-${state.labelValue || ''}`,
      labelName: state.labelName || '',
      labelValue: state.labelValue || '',
      metricsList: [],
      body: new SceneCSSGridLayout({
        templateColumns: GRID_TEMPLATE_COLUMNS,
        autoRows: GRID_AUTO_ROWS,
        isLazy: true,
        children: [],
      }),
      visibleMetricsCount: VISIBLE_METRICS_COUNT,
      paginationCount: PAGINATION_COUNT,
      loading: true,
    });

    this.addActivationHandler(() => {
      this.onActivate();
    });
  }

  private async onActivate() {
    const metricsList = await this.fetchMetricsList();

    this.setState({ metricsList });
    this.updateBodyChildren();

    this.subscribeToLayoutChange();
  }

  private async fetchMetricsList() {
    const ds = await LabelsDataSource.getPrometheusDataSource(this);
    if (!ds) {
      return [];
    }

    const { labelName, labelValue } = this.state;

    this.setState({ loading: true });

    try {
      const metricsList = await ds.languageProvider.fetchSeriesValuesWithMatch(
        '__name__',
        `{${labelName}="${labelValue}"}`
      );

      return metricsList;
    } catch (error) {
      console.error('Error while loading metric names for %s="%s"!', labelName, labelValue);
      console.error(error);
    } finally {
      this.setState({ loading: false });
    }
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

  private updateBodyChildren() {
    const { body, visibleMetricsCount, metricsList } = this.state;

    const listLength =
      visibleMetricsCount && metricsList.length >= visibleMetricsCount ? visibleMetricsCount : metricsList.length;

    const children = metricsList
      .slice(0, listLength)
      .map((metricName, colorIndex) => this.buildPanel(metricName, colorIndex))
      .filter(Boolean);

    if (!children.length) {
      body.setState({
        autoRows: 'auto',
        children: [
          new SceneCSSGridItem({
            body: new SceneReactObject({
              reactNode: <em>No results.</em>,
            }),
          }),
        ],
      });
    }

    body.setState({
      children,
      autoRows: GRID_AUTO_ROWS,
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
          headerActions: [new SelectAction({ metricName, variant: 'secondary' })],
        }),
        metric: metricName,
      }),
    });
  }

  /**
   * Adds more metric panels to the existing body
   * @param currentCount Current number of visible metrics
   * @param newCount New number of visible metrics
   */
  private addMetricPanels(currentCount: number, newCount: number) {
    const { body, metricsList } = this.state;

    const newPanels = metricsList
      .slice(currentCount, newCount)
      .map((metricName, colorIndex) => this.buildPanel(metricName, colorIndex))
      .filter(Boolean);

    body.setState({
      children: [...body.state.children, ...newPanels],
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsGroupByRow>) => {
    const styles = useStyles2(getStyles);
    const {
      labelName,
      labelValue,
      body,
      metricsList,
      visibleMetricsCount,
      paginationCount,
      index,
      labelCardinality,
      loading,
    } = model.useState();

    const variant = (sceneGraph.lookupVariable(VAR_VARIANT, model) as VariantVariable).state.value as string;

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [currentCount, setCurrentCount] = useState(visibleMetricsCount);

    const location = useLocation();
    const navigate = useNavigate();

    const onClickFilterBy = () => {
      const adHocFiltersVariable = sceneGraph.lookupVariable(VAR_FILTERS, model) as AdHocFiltersVariable;

      adHocFiltersVariable.setState({
        // TOOD: keep unique filters
        filters: [...adHocFiltersVariable.state.filters, { key: labelName, operator: '=', value: labelValue }],
      });

      navigate({
        pathname: location.pathname.replace(`/${variant}`, `/${variant.replace('onboard', 'trail')}`),
      });
    };

    const handleToggleShowMore = () => {
      // Calculate new visible count (current + pagination count, but not exceeding metricsList length)
      const newCount = Math.min(currentCount + (paginationCount ?? 9), metricsList.length);

      // Add new panels to the existing body
      model.addMetricPanels(currentCount, newCount);

      // Update current count
      setCurrentCount(newCount);
    };

    const showMoreCount = Math.min(paginationCount, metricsList.length - currentCount);
    const showPagination = visibleMetricsCount < metricsList.length;
    const isOnboardingView = location.pathname.includes('/onboard');

    return (
      <div className={styles.rowContainer}>
        <div className={styles.top}>
          <div className={styles.buttons}>
            {!isOnboardingView && (
              <Button variant="secondary" fill="outline" className={styles.excludeButton}>
                Exclude
              </Button>
            )}
            {isOnboardingView && (
              <Button
                icon="filter"
                variant="primary"
                fill="outline"
                className={styles.filterButton}
                onClick={onClickFilterBy}
              >
                Filter by
              </Button>
            )}
          </div>
        </div>

        {
          <CollapsableSection
            isOpen={!isCollapsed}
            onToggle={() => setIsCollapsed(!isCollapsed)}
            label={
              <div className={styles.groupName}>
                <Icon name="layer-group" size="lg" />
                <div className={styles.labelValue}>{labelValue}</div>
                {labelCardinality > 1 && (
                  <div className={styles.index}>
                    ({index + 1}/{labelCardinality})
                  </div>
                )}
              </div>
            }
          >
            {loading && (
              <div className={styles.loading}>
                <Spinner inline />
              </div>
            )}
            {!loading && (
              <>
                <body.Component model={body} />

                {/* Show toggle button if there are more metrics to show */}
                {showPagination && showMoreCount > 0 && (
                  <div className={styles.showMoreButton}>
                    <Button variant="secondary" fill="outline" onClick={handleToggleShowMore}>
                      Show {showMoreCount} more ({currentCount}/{metricsList.length})
                    </Button>
                  </div>
                )}
              </>
            )}
          </CollapsableSection>
        }
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
    top: css({
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '98%',
      marginBottom: '-36px',
    }),
    groupName: css({
      display: 'flex',
      alignItems: 'center',
      fontSize: '19px',
      lineHeight: '19px',
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
      '& button': {},
    }),
    filterButton: css({}),
    excludeButton: css({}),
    labelValue: css({
      fontSize: '17px',
      marginLeft: '8px',
    }),
    index: css({
      fontSize: '12px',
      color: theme.colors.text.secondary,
      marginLeft: '8px',
    }),
    loading: css({
      minHeight: '240px',
    }),
  };
}
