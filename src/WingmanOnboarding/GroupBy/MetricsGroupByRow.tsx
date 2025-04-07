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
import { Button, CollapsableSection, Icon, Spinner, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom-v5-compat';

import { InlineBanner } from 'App/InlineBanner';
import { VAR_FILTERS } from 'shared';
import { getColorByIndex } from 'utils';
import {
  MetricsWithLabelValueVariable,
  VAR_METRIC_WITH_LABEL_VALUE,
} from 'WingmanDataTrail/GroupBy/MetricsWithLabelValue/MetricsWithLabelValueVariable';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'WingmanDataTrail/HeaderControls/LayoutSwitcher';
import { GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS } from 'WingmanDataTrail/MetricsList/SimpleMetricsList';
import { METRICS_VIZ_PANEL_HEIGHT_SMALL, MetricVizPanel } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';
import { SceneByVariableRepeater } from 'WingmanDataTrail/SceneByVariableRepeater/SceneByVariableRepeater';
import { VAR_VARIANT, type VariantVariable } from 'WingmanOnboarding/VariantVariable';

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
        variables: [new MetricsWithLabelValueVariable({ labelName, labelValue, removeRules: true })],
      }),
      body: new SceneByVariableRepeater({
        variableName: VAR_METRIC_WITH_LABEL_VALUE,
        initialPageSize: 4,
        body: new SceneCSSGridLayout({
          children: [],
          isLazy: true,
          templateColumns: GRID_TEMPLATE_COLUMNS,
          autoRows: METRICS_VIZ_PANEL_HEIGHT_SMALL,
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
            body: new MetricVizPanel({
              height: METRICS_VIZ_PANEL_HEIGHT_SMALL,
              metricName: option.value as string,
              color: getColorByIndex(colorIndex),
              matchers: [`${labelName}="${labelValue}"`],
              headerActions: [],
              hideLegend: true,
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

  private useClickShowAllMetrics = () => {
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
    const styles = useStyles2(getStyles);

    const { index, labelName, labelValue, labelCardinality, $variables, body } = model.useState();
    const variable = $variables.state.variables[0] as MetricsWithLabelValueVariable;
    const batchSizes = body.useSizes();
    const onClickShowAllMetrics = model.useClickShowAllMetrics();

    return (
      <div className={styles.container}>
        <div className={styles.containerHeader}>
          <div className={styles.headerButtons}>
            <Button
              className={styles.filterButton}
              variant="primary"
              fill="solid"
              size="md"
              onClick={onClickShowAllMetrics}
              tooltip={`Show all metrics for ${labelName}="${labelValue}"`}
              tooltipPlacement="top"
            >
              Show all metrics ({batchSizes.total})
            </Button>
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
            <div className={styles.collapsableSectionBody}>
              <body.Component model={body} />
            </div>
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
      margin: theme.spacing(2, 1, 0, 1),

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
      display: 'flex',
      gap: '8px',
      marginLeft: 'auto',
      marginRight: '30px',
      zIndex: 100,
    }),
    filterButton: css({}),
    includeButton: css({}),
    excludeButton: css({}),
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
      fontSize: '1.2rem',
      marginLeft: '8px',
    }),
    index: css({
      fontSize: '12px',
      color: theme.colors.text.secondary,
      marginLeft: '8px',
    }),
    variable: css({
      display: 'none',
    }),
  };
}
