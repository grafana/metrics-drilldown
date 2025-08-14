import { css } from '@emotion/css';
import { DashboardCursorSync, type GrafanaTheme2 } from '@grafana/data';
import {
  behaviors,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  SceneReactObject,
  sceneUtils,
  type MultiValueVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Field, Spinner, useStyles2 } from '@grafana/ui';
import React from 'react';

import { InlineBanner } from 'App/InlineBanner';
import { syncYAxis } from 'Breakdown/MetricLabelsList/behaviors/syncYAxis';
import { QUERY_RESOLUTION } from 'GmdVizPanel/config/query-resolutions';
import { getTimeseriesQueryRunnerParams } from 'GmdVizPanel/types/timeseries/getTimeseriesQueryRunnerParams';
import { getPerSecondRateUnit, getUnit } from 'GmdVizPanel/units/getUnit';
import { VAR_GROUP_BY } from 'shared';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'WingmanDataTrail/ListControls/LayoutSwitcher';
import { GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS } from 'WingmanDataTrail/MetricsList/MetricsList';
import { SceneByVariableRepeater } from 'WingmanDataTrail/SceneByVariableRepeater/SceneByVariableRepeater';
import { ShowMoreButton } from 'WingmanDataTrail/ShowMoreButton';

import { LABELS_VIZ_PANEL_HEIGHT, LabelVizPanel } from './LabelVizPanel';
import { isCounterMetric } from '../../GmdVizPanel/matchers/isCounterMetric';

interface MetricLabelsListState extends SceneObjectState {
  metric: string;
  layoutSwitcher: LayoutSwitcher;
  body: SceneByVariableRepeater;
}

export class MetricLabelsList extends SceneObjectBase<MetricLabelsListState> {
  constructor({ metric }: { metric: MetricLabelsListState['metric'] }) {
    const unit = isCounterMetric(metric) ? getPerSecondRateUnit(metric) : getUnit(metric);

    super({
      key: 'metric-labels-list',
      metric,
      layoutSwitcher: new LayoutSwitcher({}),
      body: new SceneByVariableRepeater({
        variableName: VAR_GROUP_BY,
        initialPageSize: 60,
        pageSizeIncrement: 9,
        body: new SceneCSSGridLayout({
          children: [],
          isLazy: true,
          templateColumns: GRID_TEMPLATE_COLUMNS,
          autoRows: LABELS_VIZ_PANEL_HEIGHT,
          $behaviors: [
            new behaviors.CursorSync({
              key: 'metricCrosshairSync',
              sync: DashboardCursorSync.Crosshair,
            }),
            syncYAxis(),
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
                No labels found for the current filters and time range.
              </InlineBanner>
            ),
          }),
        getLayoutError: (error: Error) =>
          new SceneReactObject({
            reactNode: <InlineBanner severity="error" title="Error while loading labels!" error={error} />,
          }),
        getLayoutChild: (option, startColorIndex) => {
          const { queries } = getTimeseriesQueryRunnerParams({
            metric,
            queryConfig: {
              resolution: QUERY_RESOLUTION.MEDIUM,
              labelMatchers: [],
              addIgnoreUsageFilter: true,
              groupBy: option.value as string,
            },
          });

          return new SceneCSSGridItem({
            body: new LabelVizPanel({
              metric,
              label: option.value as string,
              query: queries[0].expr,
              unit,
              startColorIndex,
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

    // We ensure the proper layout when landing on the page:
    // because MetricLabelsList is created dynamically when LabelBreakdownScene updates its body,
    // LayoutSwitcher is not properly connected to the URL synchronization system
    sceneUtils.syncStateFromSearchParams(layoutSwitcher, new URLSearchParams(window.location.search));
    onChangeState(layoutSwitcher.state);

    this._subs.add(layoutSwitcher.subscribeToState(onChangeState));
  }

  public Controls({ model }: { model: MetricLabelsList }) {
    const { layoutSwitcher } = model.useState();
    return (
      <Field label="View">
        <layoutSwitcher.Component model={layoutSwitcher} />
      </Field>
    );
  }

  public static readonly Component = ({ model }: SceneComponentProps<MetricLabelsList>) => {
    const { body } = model.useState();
    const styles = useStyles2(getStyles);

    const variable = sceneGraph.lookupVariable(VAR_GROUP_BY, model) as MultiValueVariable;
    const { loading, error } = variable.useState();

    const batchSizes = body.useSizes();
    const shouldDisplayShowMoreButton =
      !loading && !error && batchSizes.total > 0 && batchSizes.current < batchSizes.total;

    const onClickShowMore = () => {
      body.increaseBatchSize();
    };

    return (
      <div data-testid="labels-list">
        <div className={styles.container}>
          <body.Component model={body} />
        </div>
        {shouldDisplayShowMoreButton && (
          <div className={styles.footer}>
            <ShowMoreButton label="label" batchSizes={batchSizes} onClick={onClickShowMore} />
          </div>
        )}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({ width: '100%' }),
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
