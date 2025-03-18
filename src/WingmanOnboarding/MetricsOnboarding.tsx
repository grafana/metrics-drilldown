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
  SceneVariableSet,
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
import { MetricsWithLabelValueDataSource } from 'WingmanDataTrail/GroupBy/MetricsWithLabelValue/MetricsWithLabelValueDataSource';
import { LayoutSwitcher } from 'WingmanDataTrail/HeaderControls/LayoutSwitcher';
import { QuickSearch } from 'WingmanDataTrail/HeaderControls/QuickSearch/QuickSearch';
import { registerRuntimeDataSources } from 'WingmanDataTrail/helpers/registerRuntimeDataSources';
import { LabelsDataSource } from 'WingmanDataTrail/Labels/LabelsDataSource';
import { GRID_TEMPLATE_COLUMNS, SimpleMetricsList } from 'WingmanDataTrail/MetricsList/SimpleMetricsList';
import { ApplyAction } from 'WingmanDataTrail/MetricVizPanel/actions/ApplyAction';
import { ConfigureAction } from 'WingmanDataTrail/MetricVizPanel/actions/ConfigureAction';
import { EventConfigureFunction } from 'WingmanDataTrail/MetricVizPanel/actions/EventConfigureFunction';
import { METRICS_VIZ_PANEL_HEIGHT_SMALL, MetricVizPanel } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';
import { SceneDrawer } from 'WingmanDataTrail/SceneDrawer';

import { MainLabelVariable, VAR_MAIN_LABEL_VARIABLE } from './HeaderControls/MainLabelVariable';
import { VAR_VARIANT, type VariantVariable } from './VariantVariable';
interface MetricsOnboardingState extends SceneObjectState {
  headerControls: SceneFlexLayout;
  loading: boolean;
  drawer: SceneDrawer;
  $variables: SceneVariableSet;
  body?: SceneObjectBase;
}

export class MetricsOnboarding extends SceneObjectBase<MetricsOnboardingState> {
  public static readonly LABEL_VALUES_API_LIMIT = 100;

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
    super({
      key: 'metrics-onboarding',
      $variables: new SceneVariableSet({
        variables: [new MainLabelVariable()],
      }),
      headerControls: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            body: new SceneFlexLayout({
              direction: 'row',
              maxHeight: '32px',
              children: [
                new SceneFlexItem({
                  body: new QuickSearch(),
                }),
                new SceneFlexItem({
                  body: new LayoutSwitcher(),
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

    // TODO: improve - we need to register the LabelsDataSource because LabelsVariable is attached to DataTrail
    registerRuntimeDataSources([new MetricsWithLabelValueDataSource(), new LabelsDataSource()]);

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

    this.fetchAllLabelardinalities(MainLabelVariable.OPTIONS).then((allLabelCardinalities) => {
      mainLabelVariable.setState({
        options: allLabelCardinalities.map(([labelName, labelCardinality]) => ({
          value: labelName,
          label: `${labelName} (${
            labelCardinality >= MetricsOnboarding.LABEL_VALUES_API_LIMIT
              ? MetricsOnboarding.LABEL_VALUES_API_LIMIT + '+'
              : labelCardinality
          })`,
        })),
      });

      this.setState({ loading: false });

      this.updateBody(mainLabelVariable.state.value as string);
    });
  }

  private async fetchAllLabelardinalities(labelNames: string[]): Promise<Array<[string, number]>> {
    return Promise.all(
      labelNames.map((labelName) =>
        LabelsDataSource.fetchLabelCardinality(labelName, MetricsOnboarding.LABEL_VALUES_API_LIMIT, this)
          .then((labelCardinality) => [labelName, labelCardinality] as [string, number])
          .catch((error) => {
            console.error('Error fetching "%s" label cardinality!', labelName);
            console.error(error);
            return [labelName, 0] as [string, number];
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

    const { body, headerControls, loading, drawer, $variables } = model.useState();

    const mainLabelVariable = $variables.state.variables[0] as MainLabelVariable;

    const variant = (sceneGraph.lookupVariable(VAR_VARIANT, model) as VariantVariable).state.value as string;

    const { pathname, search } = useLocation();
    const href = useMemo(
      () => pathname.replace(`/${variant}`, `/${variant.replace('onboard', 'trail')}`) + search,
      [] // eslint-disable-line react-hooks/exhaustive-deps
    ); // it's good enough capture it once when landing

    if (loading) {
      return <Spinner inline />;
    }

    return (
      <div className={styles.container}>
        <div className={styles.headerControls}>
          <div className={styles.topControls}>
            <div className={styles.mainLabelVariable}>
              <mainLabelVariable.Component model={mainLabelVariable} />
              <a
                href={href}
                className={styles.link}
                onClick={() => {
                  // in the future, maybe we move this to wherethe routing to the target Scene is done?
                  sceneGraph.findByKeyAndType(model, 'quick-search', QuickSearch).clear();
                }}
              >
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

    mainLabelVariable: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(2),
      width: '100%',
      alignItems: 'center',
    }),
    link: css({
      display: 'inline-block',
      width: '200px',
      color: theme.colors.text.primary,

      '&:hover': {
        color: theme.colors.text.link,
      },
    }),
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
