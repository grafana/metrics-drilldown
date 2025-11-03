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
import { SceneByVariableRepeater } from 'MetricsReducer/components/SceneByVariableRepeater';
import { ShowMoreButton } from 'MetricsReducer/components/ShowMoreButton';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'MetricsReducer/list-controls/LayoutSwitcher';
import { SelectAction } from 'shared/GmdVizPanel/components/SelectAction';
import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';

import { VIZ_PANEL_HEIGHT, WithUsageDataPreviewPanel } from './WithUsageDataPreviewPanel';

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
          autoRows: VIZ_PANEL_HEIGHT,
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
                  headerActions: ({ metric }) => [new SelectAction({ metric: metric.name })],
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
