import { css } from '@emotion/css';
import { DashboardCursorSync, type GrafanaTheme2 } from '@grafana/data';
import {
  behaviors,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  SceneReactObject,
  SceneVariableSet,
  type AdHocFiltersVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Alert, Button, CollapsableSection, Icon, Spinner, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom-v5-compat';

import { WithUsageDataPreviewPanel } from 'MetricSelect/WithUsageDataPreviewPanel';
import { VAR_FILTERS } from 'shared';
import { getColorByIndex } from 'utils';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'WingmanDataTrail/HeaderControls/LayoutSwitcher';
import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';
import { VAR_WINGMAN_GROUP_BY, type LabelsVariable } from 'WingmanDataTrail/Labels/LabelsVariable';
import { GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS } from 'WingmanDataTrail/MetricsList/SimpleMetricsList';
import { SelectAction } from 'WingmanDataTrail/MetricVizPanel/actions/SelectAction';
import {
  METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW,
  MetricVizPanel,
} from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';
import { SceneByVariableRepeater } from 'WingmanDataTrail/SceneByVariableRepeater/SceneByVariableRepeater';
import { VAR_VARIANT, type VariantVariable } from 'WingmanOnboarding/VariantVariable';

import {
  MetricsWithLabelValueVariable,
  VAR_METRIC_WITH_LABEL_VALUE,
} from './MetricsWithLabelValue/MetricsWithLabelValueVariable';

interface MetricsGroupByRowState extends SceneObjectState {
  index: number;
  labelName: string;
  labelValue: string;
  labelCardinality: number;
  $variables: SceneVariableSet;
  body: SceneByVariableRepeater;
}

export class MetricsGroupByRow extends SceneObjectBase<MetricsGroupByRowState> {
  public constructor({
    index,
    labelName,
    labelValue,
    labelCardinality,
  }: {
    index: MetricsGroupByRowState['index'];
    labelName: MetricsGroupByRowState['labelName'];
    labelValue: MetricsGroupByRowState['labelValue'];
    labelCardinality: MetricsGroupByRowState['labelCardinality'];
  }) {
    super({
      index,
      labelName,
      labelValue,
      labelCardinality,
      key: `${labelName || ''}-${labelValue || ''}`,
      $variables: new SceneVariableSet({
        variables: [new MetricsWithLabelValueVariable({ labelName, labelValue })],
      }),
      body: new SceneByVariableRepeater({
        variableName: VAR_METRIC_WITH_LABEL_VALUE,
        body: new SceneCSSGridLayout({
          children: [],
          isLazy: true,
          templateColumns: GRID_TEMPLATE_COLUMNS,
          autoRows: METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW,
          $behaviors: [
            new behaviors.CursorSync({
              key: 'metricCrosshairSync',
              sync: DashboardCursorSync.Crosshair,
            }),
          ],
        }),
        getLayoutLoading: () =>
          new SceneReactObject({
            reactNode: <Spinner inline />,
          }),
        getLayoutEmpty: () =>
          new SceneReactObject({
            reactNode: (
              <Alert title="" severity="info">
                No metrics found for the current filters and time range.
              </Alert>
            ),
          }),
        getLayoutError: (error: Error) =>
          new SceneReactObject({
            reactNode: (
              <Alert severity="error" title="Error while loading metrics!">
                <p>&quot;{error.message || error.toString()}&quot;</p>
                <p>Please try to reload the page. Sorry for the inconvenience.</p>
              </Alert>
            ),
          }),
        getLayoutChild: (option, colorIndex) => {
          return new SceneCSSGridItem({
            body: new WithUsageDataPreviewPanel({
              vizPanelInGridItem: new MetricVizPanel({
                metricName: option.value as string,
                color: getColorByIndex(colorIndex++),
                matchers: [`${labelName}="${labelValue}"`],
                headerActions: [new SelectAction({ metricName: option.value as string })],
              }),
              metric: option.value as string,
            }),
          });
        },
      }),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.subscribeToLayoutChange();
  }

  private subscribeToLayoutChange() {
    const layoutSwitcher = sceneGraph.findByKeyAndType(this, 'layout-switcher', LayoutSwitcher);
    const body = this.state.body.state.body as SceneCSSGridLayout;

    const onChangeState = (newState: LayoutSwitcherState, prevState?: LayoutSwitcherState) => {
      if (newState.layout !== prevState?.layout) {
        body.setState({
          templateColumns: newState.layout === LayoutType.ROWS ? GRID_TEMPLATE_ROWS : GRID_TEMPLATE_COLUMNS,
        });
      }
    };

    onChangeState(layoutSwitcher.state); // ensure layout when landing on the page

    this._subs.add(layoutSwitcher.subscribeToState(onChangeState));
  }

  private useClickFilterBy = () => {
    const { labelName, labelValue } = this.useState();
    const location = useLocation();
    const navigate = useNavigate();

    const variant = (sceneGraph.lookupVariable(VAR_VARIANT, this) as VariantVariable).state.value as string;

    return () => {
      const adHocFiltersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this) as AdHocFiltersVariable;

      adHocFiltersVariable.setState({
        // TOOD: keep unique filters
        filters: [...adHocFiltersVariable.state.filters, { key: labelName, operator: '=', value: labelValue }],
      });

      navigate({
        pathname: location.pathname.replace(`/${variant}`, `/${variant.replace('onboard', 'trail')}`),
      });
    };
  };

  public static Component = ({ model }: SceneComponentProps<MetricsGroupByRow>) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const styles = useStyles2(getStyles, isCollapsed);

    const { index, labelName, labelValue, labelCardinality, $variables, body } = model.useState();

    const variable = $variables.state.variables[0] as MetricsWithLabelValueVariable;
    const { loading, error } = variable.useState();

    const batchSizes = body.useSizes();
    const shouldDisplayShowMoreButton =
      !loading && !error && batchSizes.total > 0 && batchSizes.current < batchSizes.total;

    const location = useLocation();
    const isOnboardingView = location.pathname.includes('/onboard');

    const onClickFilterBy = model.useClickFilterBy();

    const onClickShowMore = () => {
      body.increaseBatchSize();
    };

    const onClickInclude = () => {
      const adHocFiltersVariable = sceneGraph.lookupVariable(VAR_FILTERS, model) as AdHocFiltersVariable;

      adHocFiltersVariable.setState({
        // TOOD: keep unique filters
        filters: [...adHocFiltersVariable.state.filters, { key: labelName, operator: '=', value: labelValue }],
      });

      (sceneGraph.lookupVariable(VAR_WINGMAN_GROUP_BY, model) as LabelsVariable)?.changeValueTo(NULL_GROUP_BY_VALUE);
    };

    const onClickExclude = () => {
      const adHocFiltersVariable = sceneGraph.lookupVariable(VAR_FILTERS, model) as AdHocFiltersVariable;

      adHocFiltersVariable.setState({
        // TOOD: keep unique filters
        filters: [...adHocFiltersVariable.state.filters, { key: labelName, operator: '!=', value: labelValue }],
      });
    };

    return (
      <div className={styles.container}>
        <div className={styles.containerHeader}>
          <div className={styles.headerButtons}>
            {!isOnboardingView && (
              <>
                <Button variant="secondary" fill="outline" className={styles.includeButton} onClick={onClickInclude}>
                  Include
                </Button>
                <Button variant="secondary" fill="outline" className={styles.excludeButton} onClick={onClickExclude}>
                  Exclude
                </Button>
              </>
            )}
            {isOnboardingView && (
              <Button variant="primary" fill="solid" className={styles.filterButton} onClick={onClickFilterBy}>
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
            className={styles.collapsableSection}
          >
            <body.Component model={body} />

            {shouldDisplayShowMoreButton && (
              <div className={styles.footer}>
                <Button
                  variant="secondary"
                  fill="outline"
                  onClick={onClickShowMore}
                  tooltip={`Show more metrics for ${labelName}="${labelValue}"`}
                  tooltipPlacement="top"
                >
                  Show {batchSizes.increment} more metrics ({batchSizes.current}/{batchSizes.total})
                </Button>
              </div>
            )}
          </CollapsableSection>
        }

        {/* required to trigger its activation handlers */}
        <div className={styles.variable}>
          <variable.Component key={variable.state.name} model={variable} />
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, isCollapsed: boolean) {
  return {
    container: css({
      background: theme.colors.background.canvas,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      padding: isCollapsed ? theme.spacing(2) : theme.spacing(2, 2, 0, 2),

      '& div:focus-within': {
        boxShadow: 'none !important',
      },
    }),
    containerHeader: css({
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '-36px',
    }),
    headerButtons: css({
      display: 'flex',
      gap: '8px',
      marginLeft: 'auto',
      marginRight: '30px',
      zIndex: 100,
    }),
    filterButton: css({}),
    includeButton: css({}),
    excludeButton: css({}),
    collapsableSection: css({
      height: '100%',

      '& button:focus': {
        boxShadow: 'none !important',
      },
    }),
    groupName: css({
      display: 'flex',
      alignItems: 'center',
      fontSize: '1.3rem',
      lineHeight: '1.3rem',
    }),
    labelValue: css({
      fontSize: '1.2rem',
      marginLeft: '8px',
    }),
    index: css({
      fontSize: '12px',
      color: theme.colors.text.secondary,
      marginLeft: '8px',
    }),
    footer: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: theme.spacing(4),

      '& button': {
        height: '40px',
      },
    }),
    variable: css({
      display: 'none',
    }),
  };
}
