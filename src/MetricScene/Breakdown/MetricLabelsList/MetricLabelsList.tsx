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
  VizPanel,
  type MultiValueVariable,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { Field, Spinner, useStyles2 } from '@grafana/ui';
import React from 'react';

import { InlineBanner } from 'App/InlineBanner';
import { SceneByVariableRepeater } from 'MetricsReducer/components/SceneByVariableRepeater';
import { ShowMoreButton } from 'MetricsReducer/components/ShowMoreButton';
import { LayoutSwitcher, LayoutType, type LayoutSwitcherState } from 'MetricsReducer/list-controls/LayoutSwitcher';
import { GRID_TEMPLATE_COLUMNS, GRID_TEMPLATE_ROWS } from 'MetricsReducer/MetricsList/MetricsList';
import { PANEL_HEIGHT } from 'shared/GmdVizPanel/config/panel-heights';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { addCardinalityInfo } from 'shared/GmdVizPanel/types/timeseries/behaviors/addCardinalityInfo';
import { buildTimeseriesPanel } from 'shared/GmdVizPanel/types/timeseries/buildTimeseriesPanel';
import { VAR_GROUP_BY } from 'shared/shared';

import { publishTimeseriesData } from './behaviors/publishTimeseriesData';
import { syncYAxis } from './behaviors/syncYAxis';
import { EventTimeseriesDataReceived } from './events/EventTimeseriesDataReceived';
import { SelectLabelAction } from './SelectLabelAction';
import { PanelMenu } from '../../PanelMenu/PanelMenu';

interface MetricLabelsListState extends SceneObjectState {
  metric: string;
  layoutSwitcher: LayoutSwitcher;
  body: SceneByVariableRepeater;
}

export class MetricLabelsList extends SceneObjectBase<MetricLabelsListState> {
  constructor({ metric }: { metric: MetricLabelsListState['metric'] }) {
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
          autoRows: PANEL_HEIGHT.M,
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
        getLayoutChild: (option, labelIndex) => {
          const label = option.value as string;

          return new SceneCSSGridItem({
            body: buildTimeseriesPanel({
              metric,
              panelConfig: {
                type: 'timeseries',
                height: PANEL_HEIGHT.M,
                title: label,
                fixedColorIndex: labelIndex,
                behaviors: [
                  // publishTimeseriesData is required for the syncYAxis behavior (e.g. see MetricLabelsList)
                  publishTimeseriesData(),
                  addCardinalityInfo(),
                ],
                headerActions: () => [new SelectLabelAction({ label })],
                menu: () => new PanelMenu({ labelName: label }),
                legend: { placement: 'bottom' },
              },
              queryConfig: {
                resolution: QUERY_RESOLUTION.MEDIUM,
                groupBy: label,
                labelMatchers: [],
                addIgnoreUsageFilter: true,
              },
            }),
          });
        },
      }),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.subscribeToLayoutChange();
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    const actionsLookup = new Map<string, SceneObject[]>();

    this.subscribeToEvent(EventTimeseriesDataReceived, (event) => {
      const { panelKey, series } = event.payload;
      const vizPanel = sceneGraph.findByKeyAndType(this, panelKey, VizPanel);

      if (series.length === 1) {
        if (!actionsLookup.has(panelKey)) {
          actionsLookup.set(panelKey, (vizPanel.state.headerActions as SceneObject[]) || []);
        }

        vizPanel.setState({ headerActions: [] });
        return;
      }

      if (actionsLookup.has(panelKey)) {
        vizPanel.setState({ headerActions: actionsLookup.get(panelKey) });
      }
    });
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
    const styles = useStyles2(getStyles); // eslint-disable-line react-hooks/rules-of-hooks
    const { layoutSwitcher } = model.useState();

    return (
      <Field label="View" className={styles.field}>
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
    field: css({
      marginBottom: 0,
    }),
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
