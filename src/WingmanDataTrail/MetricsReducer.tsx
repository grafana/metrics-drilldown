import { css } from '@emotion/css';
import { DashboardCursorSync, type GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import {
  behaviors,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { getColorByIndex } from 'utils';
import { VAR_VARIANT, type VariantVariable } from 'WingmanOnboarding/VariantVariable';

import { ROUTES } from '../constants';
import { MetricsGroupByList } from './GroupBy/MetricsGroupByList';
import { MetricsGroupByRow } from './GroupBy/MetricsGroupByRow';
import { MetricsWithLabelValueDataSource } from './GroupBy/MetricsWithLabelValue/MetricsWithLabelValueDataSource';
import { HeaderControls } from './HeaderControls/HeaderControls';
import { EventGroupFiltersChanged } from './HeaderControls/MetricsFilter/EventGroupFiltersChanged';
import { registerRuntimeDataSources } from './helpers/registerRuntimeDataSources';
import { LabelsDataSource, NULL_GROUP_BY_VALUE } from './Labels/LabelsDataSource';
import { VAR_WINGMAN_GROUP_BY, type LabelsVariable } from './Labels/LabelsVariable';
import { GRID_TEMPLATE_COLUMNS, SimpleMetricsList } from './MetricsList/SimpleMetricsList';
import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from './MetricsVariables/FilteredMetricsVariable';
import { ApplyAction } from './MetricVizPanel/actions/ApplyAction';
import { ConfigureAction } from './MetricVizPanel/actions/ConfigureAction';
import { EventApplyFunction } from './MetricVizPanel/actions/EventApplyFunction';
import { EventConfigureFunction } from './MetricVizPanel/actions/EventConfigureFunction';
import { METRICS_VIZ_PANEL_HEIGHT_SMALL, MetricVizPanel } from './MetricVizPanel/MetricVizPanel';
import { SceneDrawer } from './SceneDrawer';
import { type LabelsBrowser } from './SideBar/LabelsBrowser';
import { SideBar } from './SideBar/SideBar';

interface MetricsReducerState extends SceneObjectState {
  headerControls: HeaderControls;
  sidebar: SideBar | LabelsBrowser;
  body: SceneObjectBase;
  drawer: SceneDrawer;
}

export class MetricsReducer extends SceneObjectBase<MetricsReducerState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_WINGMAN_GROUP_BY],
    onReferencedVariableValueChanged: (variable) => {
      this.updateBodyBasedOnGroupBy((variable as LabelsVariable).state.value as string);
    },
  });

  public constructor() {
    super({
      headerControls: new HeaderControls({}),
      sidebar: new SideBar({}),
      body: new SimpleMetricsList() as unknown as SceneObjectBase,
      drawer: new SceneDrawer({}),
    });

    registerRuntimeDataSources([new LabelsDataSource(), new MetricsWithLabelValueDataSource()]);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const labelsVariable = sceneGraph.lookupVariable(VAR_WINGMAN_GROUP_BY, this) as LabelsVariable;
    this.updateBodyBasedOnGroupBy(labelsVariable.state.value as string);

    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    this._subs.add(
      this.subscribeToEvent(EventConfigureFunction, (event) => {
        this.openDrawer(event.payload.metricName);
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventApplyFunction, (event) => {
        this.state.drawer.close();
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventGroupFiltersChanged, (event) => {
        const { type, groups } = event.payload;
        const filteredMetricsVariable = sceneGraph.lookupVariable(
          VAR_FILTERED_METRICS_VARIABLE,
          this
        ) as FilteredMetricsVariable;

        filteredMetricsVariable.applyFilters({ [type]: groups }, true);
      })
    );
  }

  private updateBodyBasedOnGroupBy(groupByValue: string) {
    this.setState({
      body:
        !groupByValue || groupByValue === NULL_GROUP_BY_VALUE
          ? (new SimpleMetricsList() as unknown as SceneObjectBase)
          : (new MetricsGroupByList({
              labelName: groupByValue,
              GroupByRow: MetricsGroupByRow,
            }) as unknown as SceneObjectBase),
    });
  }

  private openDrawer(metricName: string) {
    this.state.drawer.open({
      title: 'Choose a new Prometheus function',
      subTitle: metricName,
      body: new SceneCSSGridLayout({
        templateColumns: GRID_TEMPLATE_COLUMNS,
        autoRows: METRICS_VIZ_PANEL_HEIGHT_SMALL,
        isLazy: true,
        $behaviors: [
          new behaviors.CursorSync({
            key: 'metricCrosshairSync',
            sync: DashboardCursorSync.Crosshair,
          }),
        ],
        children: ConfigureAction.PROMETHEUS_FN_OPTIONS.map(
          (option, colorIndex) =>
            new SceneCSSGridItem({
              body: new MetricVizPanel({
                title: option.label,
                metricName,
                color: getColorByIndex(colorIndex),
                prometheusFunction: option.value,
                height: METRICS_VIZ_PANEL_HEIGHT_SMALL,
                hideLegend: true,
                highlight: colorIndex === 1,
                headerActions: [
                  new ApplyAction({
                    metricName,
                    prometheusFunction: option.value,
                    disabled: colorIndex === 1,
                  }),
                ],
              }),
            })
        ),
      }),
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsReducer>) => {
    const chromeHeaderHeight = useChromeHeaderHeight() ?? 0;
    const styles = useStyles2(getStyles, chromeHeaderHeight);

    const { body, headerControls, drawer, sidebar } = model.useState();
    const { value: variant } = (sceneGraph.lookupVariable(VAR_VARIANT, model) as VariantVariable).useState();

    return (
      <>
        <div className={styles.headerControls} data-testid="header-controls">
          <headerControls.Component model={headerControls} />
        </div>
        <div className={styles.body}>
          {variant !== ROUTES.OnboardWithPills && (
            <div className={styles.sidebar} data-testid="sidebar">
              {sidebar instanceof SideBar ? (
                <sidebar.Component model={sidebar} />
              ) : (
                <sidebar.Component model={sidebar} />
              )}
            </div>
          )}
          <div className={styles.list}>
            <body.Component model={body} />
          </div>
        </div>
        <drawer.Component model={drawer} />
      </>
    );
  };
}

function getStyles(theme: GrafanaTheme2, chromeHeaderHeight: number) {
  return {
    headerControls: css({
      marginBottom: theme.spacing(1.5),
    }),
    body: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
      height: `calc(100vh - ${chromeHeaderHeight + 186}px)`,
    }),
    list: css({
      width: '100%',
      overflowY: 'auto',
    }),
    sidebar: css({
      flex: '0 0 320px',
      overflowY: 'hidden',
    }),
  };
}
