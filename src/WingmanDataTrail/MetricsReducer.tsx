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

import { MetricsGroupByList } from './GroupBy/MetricsGroupByList';
import { HeaderControls } from './HeaderControls/HeaderControls';
import { EventGroupFiltersChanged } from './HeaderControls/MetricsFilter/EventGroupFiltersChanged';
import { NULL_GROUP_BY_VALUE } from './Labels/LabelsDataSource';
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
import { registerRuntimeDataSources } from './registerRuntimeDataSources';
import { SceneDrawer } from './SceneDrawer';
import { SideBar } from './SideBar/SideBar';
interface MetricsReducerState extends SceneObjectState {
  headerControls: HeaderControls;
  sidebar: SideBar;
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

    registerRuntimeDataSources();

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

        filteredMetricsVariable.applyFilters({ [type]: groups });
        filteredMetricsVariable.notifyUpdate();
      })
    );
  }

  private updateBodyBasedOnGroupBy(groupByValue: string) {
    this.setState({
      body:
        !groupByValue || groupByValue === NULL_GROUP_BY_VALUE
          ? (new SimpleMetricsList() as unknown as SceneObjectBase)
          : (new MetricsGroupByList({ labelName: groupByValue }) as unknown as SceneObjectBase),
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
                groupByLabel: undefined,
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
    const styles = useStyles2(getStyles);
    const { body, headerControls, sidebar, drawer } = model.useState();
    const chromeHeaderHeight = useChromeHeaderHeight() ?? 0;

    return (
      <div
        className={styles.container}
        style={{
          height: `calc(100vh - ${chromeHeaderHeight + 132}px)`,
        }}
      >
        <div className={styles.headerControls}>
          <headerControls.Component model={headerControls} />
        </div>
        <div className={styles.sidebar}>
          <sidebar.Component model={sidebar} />
        </div>
        <div className={styles.mainContent}>
          <body.Component model={body} />
        </div>

        <drawer.Component model={drawer} />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  const headerHeight = 55; // Height of our header controls

  return {
    container: css({
      display: 'grid',
      gridTemplateRows: `${headerHeight}px calc(100% - ${headerHeight}px)`,
      gridTemplateColumns: '250px 1fr',
      gridTemplateAreas: `
        'header header'
        'sidebar content'
      `,
      height: '100%',
      overflow: 'hidden',
      position: 'relative',
    }),
    headerControls: css({
      gridArea: 'header',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(1, 0),
      zIndex: theme.zIndex.navbarFixed,
      position: 'sticky',
      top: 0,
    }),
    sidebar: css({
      paddingTop: theme.spacing(1.5),
    }),
    mainContent: css({
      padding: theme.spacing(1.5),
      height: '100%',
      overflowY: 'auto',
    }),
  };
}
