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
import { Button, CollapsableSection, Spinner, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';

import { SceneByVariableRepeater } from 'MetricsReducer/components/SceneByVariableRepeater';
import { ShowMoreButton } from 'MetricsReducer/components/ShowMoreButton';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'MetricsReducer/list-controls/LayoutSwitcher';
import { MetricsVariable } from 'MetricsReducer/metrics-variables/MetricsVariable';
import {
  VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW,
  WithUsageDataPreviewPanel,
} from 'MetricsReducer/MetricsList/WithUsageDataPreviewPanel';
import { GroupsIcon } from 'MetricsReducer/SideBar/custom-icons/GroupsIcon';
import { ConfigurePanelAction } from 'shared/GmdVizPanel/components/ConfigurePanelAction';
import { SelectAction } from 'shared/GmdVizPanel/components/SelectAction';
import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { VAR_FILTERS } from 'shared/shared';

import { GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS } from '..//MetricsList/MetricsList';
import { InlineBanner } from '../../App/InlineBanner';
import { NULL_GROUP_BY_VALUE } from '../labels/LabelsDataSource';
import { VAR_WINGMAN_GROUP_BY, type LabelsVariable } from '../labels/LabelsVariable';

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
    const variableName = `var-metrics-${labelName}-${labelValue}`;

    super({
      index,
      labelName,
      labelValue,
      labelCardinality,
      key: `${labelName}-${labelValue}`,
      $variables: new SceneVariableSet({
        variables: [
          new MetricsVariable({
            key: variableName,
            name: variableName,
            labelMatcher: { key: labelName, operator: '=', value: labelValue },
            addLifeCycleEvents: true,
          }),
        ],
      }),
      body: new SceneByVariableRepeater({
        variableName: variableName,
        initialPageSize: 3,
        body: new SceneCSSGridLayout({
          children: [],
          isLazy: true,
          templateColumns: GRID_TEMPLATE_COLUMNS,
          autoRows: VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW,
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
              <InlineBanner title="" severity="info">
                No metrics found for the current filters and time range.
              </InlineBanner>
            ),
          }),
        getLayoutError: (error: Error) =>
          new SceneReactObject({
            reactNode: <InlineBanner severity="error" title="Error while loading metrics!" error={error} />,
          }),
        getLayoutChild: (option, colorIndex) => {
          return new SceneCSSGridItem({
            body: new WithUsageDataPreviewPanel({
              metric: option.value as string,
              vizPanelInGridItem: new GmdVizPanel({
                metric: option.value as string,
                panelOptions: {
                  fixedColorIndex: colorIndex,
                  headerActions: ({ metric }) => [
                    new SelectAction({ metric: metric.name }),
                    new ConfigurePanelAction({ metric }),
                  ],
                },
                queryOptions: {
                  labelMatchers: [{ key: labelName, operator: '=', value: labelValue }],
                },
              }),
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

  public static readonly Component = ({ model }: SceneComponentProps<MetricsGroupByRow>) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const styles = useStyles2(getStyles);

    const { index, labelName, labelValue, labelCardinality, $variables, body } = model.useState();

    const variable = $variables.state.variables[0] as MetricsVariable;
    const { loading, error } = variable.useState();

    const batchSizes = body.useSizes();
    const shouldDisplayShowMoreButton =
      !loading && !error && batchSizes.total > 0 && batchSizes.current < batchSizes.total;

    const onClickShowMore = () => {
      body.increaseBatchSize();
    };

    const onClickSelect = () => {
      const adHocFiltersVariable = sceneGraph.lookupVariable(VAR_FILTERS, model) as AdHocFiltersVariable;

      adHocFiltersVariable.setState({
        // TOOD: keep unique filters
        filters: [...adHocFiltersVariable.state.filters, { key: labelName, operator: '=', value: labelValue }],
      });

      (sceneGraph.lookupVariable(VAR_WINGMAN_GROUP_BY, model) as LabelsVariable)?.changeValueTo(NULL_GROUP_BY_VALUE);
    };

    return (
      <div className={styles.container} data-testid={`${labelName}-${labelValue}-metrics-group`}>
        <div className={styles.containerHeader}>
          <div className={styles.headerButtons}>
            <Button
              className={styles.selectButton}
              variant="secondary"
              onClick={onClickSelect}
              tooltip={`See metrics with ${labelName}=${labelValue}`}
              tooltipPlacement="top"
            >
              Select
            </Button>
          </div>
        </div>

        {
          <CollapsableSection
            isOpen={!isCollapsed}
            onToggle={() => setIsCollapsed(!isCollapsed)}
            label={
              <div className={styles.groupName}>
                <GroupsIcon />
                <div className={styles.labelValue}>{labelValue}</div>
                {labelCardinality > 1 && (
                  <div className={styles.index}>
                    ({index + 1}/{labelCardinality})
                  </div>
                )}
              </div>
            }
          >
            <div className={styles.collapsableSectionBody}>
              <body.Component model={body} />
            </div>

            {shouldDisplayShowMoreButton && (
              <div className={styles.footer}>
                <ShowMoreButton
                  label="metric"
                  batchSizes={batchSizes}
                  onClick={onClickShowMore}
                  tooltip={`Show more metrics for ${labelName}="${labelValue}"`}
                />
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

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      background: theme.colors.background.canvas,
      margin: theme.spacing(1, 0, 0, 0),

      '& div:focus-within': {
        boxShadow: 'none !important',
      },
    }),
    containerHeader: css({
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '-36px',
      paddingBottom: theme.spacing(1.5),
      borderBottom: `1px solid ${theme.colors.border.medium}`,
    }),
    headerButtons: css({
      position: 'relative',
      top: '3px',
      marginLeft: 'auto',
      marginRight: '30px',
      zIndex: 100,
    }),
    selectButton: css({
      height: '28px',
    }),
    collapsableSectionBody: css({
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: theme.spacing(1),
    }),
    groupName: css({
      display: 'flex',
      alignItems: 'center',
      fontSize: '1.3rem',
      lineHeight: '1.3rem',
    }),
    labelValue: css({
      fontSize: '16px',
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
      marginTop: theme.spacing(1),

      '& button': {
        height: '40px',
      },
    }),
    variable: css({
      display: 'none',
    }),
  };
}
