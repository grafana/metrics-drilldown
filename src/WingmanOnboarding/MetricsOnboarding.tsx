import { css } from '@emotion/css';
import { DashboardCursorSync, type GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import {
  behaviors,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Icon, Spinner, useStyles2 } from '@grafana/ui';
import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { VAR_DATASOURCE } from 'shared';
import { getColorByIndex } from 'utils';
import { MetricsGroupByList } from 'WingmanDataTrail/GroupBy/MetricsGroupByList';
import { LayoutSwitcher } from 'WingmanDataTrail/HeaderControls/LayoutSwitcher';
import { QuickSearch } from 'WingmanDataTrail/HeaderControls/QuickSearch/QuickSearch';
import { LabelsDataSource } from 'WingmanDataTrail/Labels/LabelsDataSource';
import { GRID_TEMPLATE_COLUMNS, SimpleMetricsList } from 'WingmanDataTrail/MetricsList/SimpleMetricsList';
import { ApplyAction } from 'WingmanDataTrail/MetricVizPanel/actions/ApplyAction';
import { ConfigureAction } from 'WingmanDataTrail/MetricVizPanel/actions/ConfigureAction';
import { EventConfigureFunction } from 'WingmanDataTrail/MetricVizPanel/actions/EventConfigureFunction';
import { METRICS_VIZ_PANEL_HEIGHT_SMALL, MetricVizPanel } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';
import { registerRuntimeDataSources } from 'WingmanDataTrail/registerRuntimeDataSources';
import { SceneDrawer } from 'WingmanDataTrail/SceneDrawer';

import { MainLabelVariable, VAR_MAIN_LABEL_VARIABLE } from './HeaderControls/MainLabelVariable';
import { VAR_VARIANT, type VariantVariable } from './VariantVariable';
interface MetricsOnboardingState extends SceneObjectState {
  headerControls: SceneFlexLayout;
  allLabelValues: Map<string, string[]>;
  loading: boolean;
  drawer: SceneDrawer;
  body?: SceneObjectBase;
}

export class MetricsOnboarding extends SceneObjectBase<MetricsOnboardingState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_MAIN_LABEL_VARIABLE, VAR_DATASOURCE],
    onReferencedVariableValueChanged: (variable) => {
      if (variable.state.name === VAR_DATASOURCE) {
        (sceneGraph.lookupVariable(VAR_MAIN_LABEL_VARIABLE, this) as MainLabelVariable).setState({ value: undefined });

        this.fetchAndLabelValuesAndUpdateBody();
        return;
      }

      if (variable.state.name === VAR_MAIN_LABEL_VARIABLE) {
        this.updateBody((variable as MainLabelVariable).state.value as string);
      }
    },
  });

  constructor() {
    const quickSearch = new QuickSearch();
    const layoutSwitcher = new LayoutSwitcher();

    super({
      key: 'metrics-onboarding',
      allLabelValues: new Map(),
      headerControls: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            body: new SceneFlexLayout({
              direction: 'row',
              maxHeight: '32px',
              children: [
                new SceneFlexItem({
                  body: quickSearch,
                }),
                new SceneFlexItem({
                  body: layoutSwitcher,
                  width: 'auto',
                }),
              ],
            }),
          }),
        ],
      }),
      loading: true,
      drawer: new SceneDrawer({}),
      body: undefined,
    });

    registerRuntimeDataSources();

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const mainLabelVariable = sceneGraph.lookupVariable(VAR_MAIN_LABEL_VARIABLE, this) as MainLabelVariable;

    this._subs.add(
      mainLabelVariable.subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          this.updateBody(newState.value as string);
        }
      })
    );

    this._subs.add(
      this.subscribeToEvent(EventConfigureFunction, (event) => {
        this.openDrawer(event.payload.metricName);
      })
    );

    this.fetchAndLabelValuesAndUpdateBody();
  }

  private fetchAndLabelValuesAndUpdateBody() {
    const mainLabelVariable = sceneGraph.lookupVariable(VAR_MAIN_LABEL_VARIABLE, this) as MainLabelVariable;

    this.fetchLabelValues(MainLabelVariable.OPTIONS).then((allLabelValues) => {
      mainLabelVariable.setState({
        options: allLabelValues.map(([labelName, labelValues]) => ({
          value: labelName,
          label: labelValues !== undefined ? `${labelName} (${labelValues.length})` : (labelName as string),
        })),
      });

      this.setState({
        loading: false,
        allLabelValues: new Map(allLabelValues),
      });

      this.updateBody(mainLabelVariable.state.value as string);
    });
  }

  private async fetchLabelValues(labelNames: string[]): Promise<Array<[string, string[]]>> {
    return Promise.all(
      labelNames.map((labelName) =>
        LabelsDataSource.fetchLabelValues(labelName, this)
          .then((labelValues: string[]) => [labelName, labelValues] as [string, string[]])
          .catch((error) => {
            console.error('Error fetching "%s" label values!', labelName);
            console.error(error);
            return [labelName, []] as [string, string[]];
          })
      )
    );
  }

  private updateBody(groupByValue: string) {
    this.setState({
      body: !groupByValue
        ? (new SimpleMetricsList() as unknown as SceneObjectBase)
        : (new MetricsGroupByList({
            labelName: groupByValue,
            labelValues: this.state.allLabelValues.get(groupByValue),
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

  public static Component = ({ model }: SceneComponentProps<MetricsOnboarding>) => {
    const chromeHeaderHeight = useChromeHeaderHeight() ?? 0;
    const styles = useStyles2(getStyles, chromeHeaderHeight);

    const { body, headerControls, loading, drawer } = model.useState();

    const mainLabelVariable = sceneGraph.lookupVariable(VAR_MAIN_LABEL_VARIABLE, model) as MainLabelVariable;
    const variant = (sceneGraph.lookupVariable(VAR_VARIANT, model) as VariantVariable).state.value as string;

    const { pathname, search } = useLocation();
    const href = useMemo(() => {
      const searchParams = new URLSearchParams(search);
      searchParams.delete(QuickSearch.URL_SEARCH_PARAM_NAME);

      return pathname.replace(`/${variant}`, `/${variant.replace('onboard', 'trail')}`) + '?' + searchParams.toString();
    }, [pathname, variant, search]);

    if (loading) {
      return <Spinner inline />;
    }

    return (
      <div className={styles.container}>
        <div className={styles.headerControls}>
          <div className={styles.topControls}>
            <div className={styles.mainLabelVariable}>
              <mainLabelVariable.Component model={mainLabelVariable} />
            </div>
            <div>
              <a href={href} className={styles.link}>
                Go to detailled filtering <Icon name="angle-right" />
              </a>
            </div>
          </div>

          <div className={styles.listControls}>
            <headerControls.Component model={headerControls} />
          </div>
        </div>
        <div className={styles.body}>{body && <body.Component model={body} />}</div>
        <drawer.Component model={drawer} />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, chromeHeaderHeight: number) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: theme.spacing(1),
    }),
    headerControls: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    topControls: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(2),
      alignItems: 'center',
    }),
    link: css({
      color: theme.colors.text.primary,
      '&:hover': {
        color: theme.colors.text.link,
      },
    }),
    mainLabelVariable: css({}),
    listControls: css({
      marginBottom: theme.spacing(0.5),
    }),
    body: css({
      width: '100%',
      height: `calc(100vh - ${chromeHeaderHeight + 284}px)`,
      overflowY: 'auto',
    }),
  };
}
