import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  behaviors,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  SceneReactObject,
  type MultiValueVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';
import { Spinner, useStyles2 } from '@grafana/ui';
import React from 'react';

import { InlineBanner } from 'App/InlineBanner';
import { WithUsageDataPreviewPanel } from 'WingmanDataTrail/MetricsList/WithUsageDataPreviewPanel';
import { VAR_FILTERS } from 'shared';
import { getColorByIndex, getTrailFor } from 'utils';
import { isAdHocFiltersVariable } from 'utils/utils.variables';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'WingmanDataTrail/ListControls/LayoutSwitcher';
import { METRICS_VIZ_PANEL_HEIGHT, MetricVizPanel } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';
import { SceneByVariableRepeater } from 'WingmanDataTrail/SceneByVariableRepeater/SceneByVariableRepeater';
import { ShowMoreButton } from 'WingmanDataTrail/ShowMoreButton';

export const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';
export const GRID_TEMPLATE_ROWS = '1fr';

interface MetricsListState extends SceneObjectState {
  variableName: string;
  body: SceneByVariableRepeater;
}

export class MetricsList extends SceneObjectBase<MetricsListState> {
  constructor({ variableName }: { variableName: MetricsListState['variableName'] }) {
    super({
      key: 'metrics-list',
      variableName,
      body: new SceneByVariableRepeater({
        variableName,
        initialPageSize: 120,
        pageSizeIncrement: 9,
        body: new SceneCSSGridLayout({
          children: [],
          isLazy: true,
          templateColumns: GRID_TEMPLATE_COLUMNS,
          autoRows: METRICS_VIZ_PANEL_HEIGHT,
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

          // get the VAR_FILTERS variable to pass in the correct matchers for the functions
          const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);

          const matchers = isAdHocFiltersVariable(filtersVariable)
            ? filtersVariable.state.filters.map((filter) => `${filter.key}${filter.operator}${filter.value}`)
            : [];

          return new SceneCSSGridItem({
            body: new WithUsageDataPreviewPanel({
              vizPanelInGridItem: new MetricVizPanel({
                metricName: option.value as string,
                color: getColorByIndex(colorIndex),
                isNativeHistogram,
                matchers,
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

  public static readonly Component = ({ model }: SceneComponentProps<MetricsList>) => {
    const { variableName, body } = model.useState();
    const styles = useStyles2(getStyles);

    const variable = sceneGraph.lookupVariable(variableName, model) as MultiValueVariable;
    const { loading, error } = variable.useState();

    const batchSizes = body.useSizes();
    const shouldDisplayShowMoreButton =
      !loading && !error && batchSizes.total > 0 && batchSizes.current < batchSizes.total;

    const onClickShowMore = () => {
      body.increaseBatchSize();
    };

    return (
      <div data-testid="metrics-list">
        <div className={styles.container}>
          <body.Component model={body} />
        </div>
        {shouldDisplayShowMoreButton && (
          <div className={styles.footer}>
            <ShowMoreButton label="metric" batchSizes={batchSizes} onClick={onClickShowMore} />
          </div>
        )}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({}),
    footer: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: theme.spacing(4),

      '& button': {
        height: '40px',
        borderRadius: '8px',
      },
    }),
  };
}
