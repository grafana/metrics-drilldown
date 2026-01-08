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
import { type Metric } from 'shared/GmdVizPanel/matchers/getMetricType';
import { addCardinalityInfo } from 'shared/GmdVizPanel/types/timeseries/behaviors/addCardinalityInfo';
import { buildTimeseriesPanel } from 'shared/GmdVizPanel/types/timeseries/buildTimeseriesPanel';
import { VAR_GROUP_BY } from 'shared/shared';
import { getTrailFor } from 'shared/utils/utils';

import { publishTimeseriesData } from './behaviors/publishTimeseriesData';
import { syncYAxis } from './behaviors/syncYAxis';
import { ClickablePanelWrapper } from './ClickablePanelWrapper';
import { EventTimeseriesDataReceived } from './events/EventTimeseriesDataReceived';
import { SelectLabelAction } from './SelectLabelAction';
import { buildMiniBreakdownNavigationUrl } from '../../../exposedComponents/MiniBreakdown/buildNavigationUrl';
import { PanelMenu } from '../../PanelMenu/PanelMenu';

interface MetricLabelsListState extends SceneObjectState {
  metric: Metric;
  layoutSwitcher: LayoutSwitcher;
  body: SceneByVariableRepeater;
}

/** Build navigation URL for embeddedMini label panel click */
function buildLabelNavigationUrl(trail: ReturnType<typeof getTrailFor>, label: string): string {
  const timeRange = sceneGraph.getTimeRange(trail);
  return buildMiniBreakdownNavigationUrl({
    metric: trail.state.metric!,
    labels: (trail.state.initialFilters || []).map((f) => ({
      label: f.key,
      op: f.operator,
      value: f.value,
    })),
    dataSource: trail.state.initialDS!,
    from: String(timeRange.state.from),
    to: String(timeRange.state.to),
    groupBy: label, // When groupBy is set, actionView=breakdown is automatically added
  });
}

/** Get panel config for label panel, adjusted for embeddedMini mode */
function getLabelPanelConfig(label: string, labelIndex: number, embeddedMini: boolean) {
  return {
    type: 'timeseries' as const,
    height: embeddedMini ? PANEL_HEIGHT.XS : PANEL_HEIGHT.M,
    title: label,
    fixedColorIndex: labelIndex,
    behaviors: embeddedMini
      ? [addCardinalityInfo({ description: { ctaText: '' } })]
      : [publishTimeseriesData(), addCardinalityInfo()],
    headerActions: embeddedMini ? () => [] : () => [new SelectLabelAction({ label })],
    menu: embeddedMini ? undefined : () => new PanelMenu({ labelName: label }),
    legend: embeddedMini ? { showLegend: false } : { placement: 'bottom' as const },
  };
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

          // Check embeddedMini at runtime
          let embeddedMini = false;
          let trail;
          try {
            trail = getTrailFor(this);
            embeddedMini = trail.state.embeddedMini ?? false;
          } catch {
            // Not in scene graph yet, use default
          }

          const panel = buildTimeseriesPanel({
            metric,
            panelConfig: getLabelPanelConfig(label, labelIndex, embeddedMini),
            queryConfig: {
              resolution: QUERY_RESOLUTION.MEDIUM,
              groupBy: label,
              labelMatchers: [],
              addIgnoreUsageFilter: true,
            },
          });

          // Wrap panel with click navigation in embeddedMini mode
          if (embeddedMini && trail) {
            return new SceneCSSGridItem({
              body: new ClickablePanelWrapper({
                panel,
                navigationUrl: buildLabelNavigationUrl(trail, label),
                title: `Breakdown by ${label}`,
              }),
            });
          }

          return new SceneCSSGridItem({
            body: panel,
          });
        },
      }),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const trail = getTrailFor(this);

    // In embeddedMini mode, limit to 3 panels with smaller height and rows layout
    if (trail.state.embeddedMini) {
      this.state.body.setState({ initialPageSize: 3, pageSizeIncrement: 0 });
      (this.state.body.state.body as SceneCSSGridLayout).setState({
        autoRows: PANEL_HEIGHT.XS,
        templateColumns: GRID_TEMPLATE_ROWS,
      });
    }

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
    const trail = getTrailFor(this);

    // Skip URL sync entirely for embeddedMini - layout already set in onActivate
    if (trail.state.embeddedMini) {
      return;
    }

    const layoutSwitcher = sceneGraph.findByKeyAndType(this, 'layout-switcher', LayoutSwitcher);

    const onChangeState = (newState: LayoutSwitcherState, prevState?: LayoutSwitcherState) => {
      if (newState.layout !== prevState?.layout) {
        (this.state.body.state.body as SceneCSSGridLayout).setState({
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
    const styles = useStyles2(getStyles);
    const { body } = model.useState();
    const trail = getTrailFor(model);
    const { embeddedMini } = trail.state;

    const variable = sceneGraph.lookupVariable(VAR_GROUP_BY, model) as MultiValueVariable;
    const { loading, error } = variable.useState();

    const batchSizes = body.useSizes();
    const shouldDisplayShowMoreButton =
      !embeddedMini && !loading && !error && batchSizes.total > 0 && batchSizes.current < batchSizes.total;

    const onClickShowMore = () => {
      body.increaseBatchSize();
    };

    return (
      <div data-testid="labels-list">
        <body.Component model={body} />
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
