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

import { InlineBanner } from 'App/InlineBanner';
import { VAR_FILTERS } from 'shared';
import { getColorByIndex, getTrailFor } from 'utils';
import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';
import { VAR_WINGMAN_GROUP_BY, type LabelsVariable } from 'WingmanDataTrail/Labels/LabelsVariable';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'WingmanDataTrail/ListControls/LayoutSwitcher';
import { GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS } from 'WingmanDataTrail/MetricsList/MetricsList';
import { SelectAction } from 'WingmanDataTrail/MetricVizPanel/actions/SelectAction';
import {
  METRICS_VIZ_PANEL_HEIGHT_WITH_USAGE_DATA_PREVIEW,
  MetricVizPanel,
} from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';
import { WithUsageDataPreviewPanel } from 'WingmanDataTrail/MetricVizPanel/WithUsageDataPreviewPanel';
import { SceneByVariableRepeater } from 'WingmanDataTrail/SceneByVariableRepeater/SceneByVariableRepeater';
import { ShowMoreButton } from 'WingmanDataTrail/ShowMoreButton';
import { GroupsIcon } from 'WingmanDataTrail/SideBar/custom-icons/GroupsIcon';

import {
  MetricsWithLabelValueVariable,
  VAR_METRIC_WITH_LABEL_VALUE,
} from './MetricsWithLabelValue/MetricsWithLabelValueVariable';

export interface MetricsGroupByRowState extends SceneObjectState {
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
        initialPageSize: 3,
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
          const trail = getTrailFor(this);
          const isNativeHistogram = trail.isNativeHistogram(option.value as string);

          return new SceneCSSGridItem({
            body: new WithUsageDataPreviewPanel({
              vizPanelInGridItem: new MetricVizPanel({
                metricName: option.value as string,
                color: getColorByIndex(colorIndex),
                matchers: [`${labelName}="${labelValue}"`],
                headerActions: [new SelectAction({ metricName: option.value as string })],
                isNativeHistogram,
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

  public static readonly Component = ({ model }: SceneComponentProps<MetricsGroupByRow>) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const styles = useStyles2(getStyles);

    const { index, labelName, labelValue, labelCardinality, $variables, body } = model.useState();

    const variable = $variables.state.variables[0] as MetricsWithLabelValueVariable;
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
      <div className={styles.container}>
        <div className={styles.containerHeader}>
          <div className={styles.headerButtons}>
            <Button className={styles.selectButton} variant="secondary" onClick={onClickSelect}>
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
