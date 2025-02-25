import { css } from '@emotion/css';
import { type DataSourceInstanceSettings, type DataSourceJsonData, type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  getExploreURL,
  QueryVariable,
  sceneGraph,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  SceneQueryRunner,
  SceneVariableSet,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { Box, Icon, LinkButton, Stack, Tab, TabsBar, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { type MetricsLogsConnector } from 'Integrations/logs/base';

import { buildMetricOverviewScene } from './ActionTabs/MetricOverviewScene';
import { buildRelatedMetricsScene } from './ActionTabs/RelatedMetricsScene';
import { AutoVizPanel } from './autoQuery/components/AutoVizPanel';
import { getAutoQueriesForMetric } from './autoQuery/getAutoQueriesForMetric';
import { type AutoQueryDef, type AutoQueryInfo } from './autoQuery/types';
import { buildLabelBreakdownActionScene } from './Breakdown/LabelBreakdownScene';
import { createLabelsCrossReferenceConnector } from './Integrations/logs/labelsCrossReference';
import { lokiRecordingRulesConnector } from './Integrations/logs/lokiRecordingRules';
import { reportExploreMetrics } from './interactions';
import {
  MAIN_PANEL_MAX_HEIGHT,
  MAIN_PANEL_MIN_HEIGHT,
  METRIC_AUTOVIZPANEL_KEY,
  MetricGraphScene,
} from './MetricGraphScene';
import { buildRelatedLogsScene, findHealthyLokiDataSources } from './RelatedLogs/RelatedLogsScene';
import {
  getVariablesWithMetricConstant,
  MetricSelectedEvent,
  RefreshMetricsEvent,
  trailDS,
  VAR_FILTERS,
  VAR_GROUP_BY,
  VAR_METRIC_EXPR,
  type ActionViewDefinition as BaseActionViewDefinition,
  type ActionViewType,
  type MakeOptional,
} from './shared';
import { ShareTrailButton } from './ShareTrailButton';
import { useBookmarkState } from './TrailStore/useBookmarkState';
import { getTrailFor, getUrlForTrail } from './utils';

const relatedLogsFeatureEnabled = config.featureToggles.exploreMetricsRelatedLogs;

export interface MetricSceneState extends SceneObjectState {
  body: MetricGraphScene;
  metric: string;
  nativeHistogram?: boolean;
  actionView?: string;

  autoQuery: AutoQueryInfo;
  queryDef?: AutoQueryDef;
  relatedLogsCount?: number;
  lokiDataSources?: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
}

export class MetricScene extends SceneObjectBase<MetricSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['actionView'] });

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS],
    onReferencedVariableValueChanged: () => {
      // When filters change, re-initialize the logs count check for all datasources
      if (this.state.lokiDataSources?.length) {
        // Reset counts and re-check all datasources
        this.updateRelatedLogsCount(0);
        this._initializeLogsCount();
      }
    },
  });

  private _logsQueryRunner?: SceneQueryRunner;
  private _logsConnectors?: MetricsLogsConnector[];

  public constructor(state: MakeOptional<MetricSceneState, 'body' | 'autoQuery'>) {
    const autoQuery = state.autoQuery ?? getAutoQueriesForMetric(state.metric, state.nativeHistogram);
    super({
      $variables: state.$variables ?? getVariableSet(state.metric),
      body: state.body ?? new MetricGraphScene({}),
      autoQuery,
      queryDef: state.queryDef ?? autoQuery.main,
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    if (this.state.actionView === undefined) {
      this.setActionView('overview');
    }

    if (relatedLogsFeatureEnabled) {
      this._initializeLokiDatasources();
    }

    if (config.featureToggles.enableScopesInMetricsExplore) {
      // Push the scopes change event to the tabs
      // The event is not propagated because the tabs are not part of the scene graph
      this._subs.add(
        this.subscribeToEvent(RefreshMetricsEvent, (event) => {
          this.state.body.state.selectedTab?.publishEvent(event);
        })
      );
    }
  }

  private async _initializeLokiDatasources() {
    const lokiDataSources = await findHealthyLokiDataSources();
    this.setState({
      lokiDataSources,
      relatedLogsCount: 0,
    });

    // If we have Loki datasources, initialize a background query to get counts
    if (lokiDataSources.length > 0) {
      this._initializeLogsCount();
    }
  }

  private _initializeLogsCount() {
    const { lokiDataSources } = this.state;
    if (!lokiDataSources?.length) {
      return;
    }

    // Create background connectors
    this._logsConnectors = [lokiRecordingRulesConnector, createLabelsCrossReferenceConnector(this)];

    // Track datasources with logs
    const datasourcesWithLogs: Array<DataSourceInstanceSettings<DataSourceJsonData>> = [];
    let totalLogsCount = 0;

    // Check each datasource for logs
    lokiDataSources.forEach((datasource) => {
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: datasource.uid },
        queries: [],
        key: `logs_check_${datasource.uid}`,
      });

      // Build queries for this datasource
      const lokiQueries = this._logsConnectors!.reduce<Record<string, string>>((acc, connector, idx) => {
        const lokiExpr = connector.getLokiQueryExpr(this.state.metric, datasource.uid);
        if (lokiExpr) {
          acc[connector.name ?? `connector-${idx}`] = lokiExpr;
        }
        return acc;
      }, {});

      // Set queries
      queryRunner.setState({
        queries: Object.keys(lokiQueries).map((connectorName) => ({
          refId: `RelatedLogs-${connectorName}`,
          expr: lokiQueries[connectorName],
          maxLines: 100, // Get a reasonable number of logs for counting
        })),
      });

      // Subscribe to results
      this._subs.add(
        queryRunner.subscribeToState((state) => {
          if (state.data?.series) {
            const rowCount = state.data.series.reduce((sum: number, frame) => sum + frame.length, 0);
            if (rowCount > 0) {
              // This datasource has logs
              if (!datasourcesWithLogs.includes(datasource)) {
                datasourcesWithLogs.push(datasource);

                // Update total count (add this datasource's logs to the total)
                totalLogsCount += rowCount;
                this.updateRelatedLogsCount(totalLogsCount);

                // Update available datasources
                this.setState({
                  lokiDataSources: datasourcesWithLogs,
                });
              }
            }
          }
        })
      );

      // Activate query
      queryRunner.activate();

      // Clean up
      this._subs.add(() => queryRunner.setState({ queries: [] }));
    });

    // If we have a main query runner already, clean it up
    if (this._logsQueryRunner) {
      this._logsQueryRunner.setState({ queries: [] });
      this._logsQueryRunner = undefined;
    }
  }

  public updateRelatedLogsCount(count: number) {
    this.setState({ relatedLogsCount: count });
    // You can add additional logic here if needed for tab updates
  }

  getUrlState() {
    return { actionView: this.state.actionView };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.actionView === 'string') {
      if (this.state.actionView !== values.actionView) {
        const actionViewDef = actionViewsDefinitions.find((v) => v.value === values.actionView);
        if (actionViewDef) {
          this.setActionView(actionViewDef.value);
        }
      }
    } else if (values.actionView === null) {
      this.setActionView(undefined);
    }
  }

  public setActionView(actionView?: ActionViewType) {
    const { body, lokiDataSources } = this.state;
    const actionViewDef = actionViewsDefinitions.find((v) => v.value === actionView);

    if (actionViewDef && actionViewDef.value !== this.state.actionView) {
      // reduce max height for main panel to reduce height flicker
      body.state.topView.state.children[0].setState({ maxHeight: MAIN_PANEL_MIN_HEIGHT });

      const scene =
        actionViewDef.value === 'related_logs' && lokiDataSources
          ? actionViewDef.getScene({ lokiDataSources })
          : actionViewDef.getScene();

      body.setState({ selectedTab: scene });
      this.setState({ actionView: actionViewDef.value });
    } else {
      // restore max height
      body.state.topView.state.children[0].setState({ maxHeight: MAIN_PANEL_MAX_HEIGHT });
      body.setState({ selectedTab: undefined });
      this.setState({ actionView: undefined });
    }
  }

  static Component = ({ model }: SceneComponentProps<MetricScene>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}

interface ActionViewDefinition extends BaseActionViewDefinition {
  getDisplayName?: (scene: MetricScene) => string;
  getScene: (props?: any) => SceneObject<SceneObjectState>;
}

const actionViewsDefinitions: ActionViewDefinition[] = [
  { displayName: 'Overview', value: 'overview', getScene: buildMetricOverviewScene },
  { displayName: 'Breakdown', value: 'breakdown', getScene: buildLabelBreakdownActionScene },
  {
    displayName: 'Related metrics',
    value: 'related',
    getScene: buildRelatedMetricsScene,
    description: 'Relevant metrics based on current label filters',
  },
];

if (relatedLogsFeatureEnabled) {
  actionViewsDefinitions.push({
    displayName: 'Related logs',
    value: 'related_logs',
    getScene: buildRelatedLogsScene,
    description: 'Relevant logs based on current label filters and time range',
  });
}

export interface MetricActionBarState extends SceneObjectState {}

export class MetricActionBar extends SceneObjectBase<MetricActionBarState> {
  public getLinkToExplore = async () => {
    const metricScene = sceneGraph.getAncestor(this, MetricScene);
    const autoVizPanel = sceneGraph.findByKeyAndType(this, METRIC_AUTOVIZPANEL_KEY, AutoVizPanel);
    const panelData =
      typeof autoVizPanel.state.panel !== 'undefined'
        ? sceneGraph.getData(autoVizPanel.state.panel).state.data
        : undefined;

    if (!panelData) {
      throw new Error('Cannot get link to explore, no panel data found');
    }

    return getExploreURL(panelData, metricScene, panelData.timeRange);
  };

  public openExploreLink = async () => {
    reportExploreMetrics('selected_metric_action_clicked', { action: 'open_in_explore' });
    this.getLinkToExplore().then((link) => {
      // We use window.open instead of a Link or <a> because we want to compute the explore link when clicking,
      // if we precompute it we have to keep track of a lot of dependencies
      window.open(link, '_blank');
    });
  };

  public static Component = ({ model }: SceneComponentProps<MetricActionBar>) => {
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
    const styles = useStyles2(getStyles);
    const trail = getTrailFor(model);
    const [isBookmarked, toggleBookmark] = useBookmarkState(trail);
    const { actionView } = metricScene.useState();

    return (
      <Box paddingY={1}>
        <div className={styles.actions}>
          <Stack gap={1}>
            <ToolbarButton
              variant={'canvas'}
              tooltip="Remove existing metric and choose a new metric"
              onClick={() => {
                reportExploreMetrics('selected_metric_action_clicked', { action: 'unselect' });
                trail.publishEvent(new MetricSelectedEvent(undefined));
              }}
            >
              Select new metric
            </ToolbarButton>
            <ToolbarButton
              variant={'canvas'}
              icon="compass"
              tooltip="Open in explore"
              onClick={model.openExploreLink}
            ></ToolbarButton>
            <ShareTrailButton trail={trail} />
            <ToolbarButton
              variant={'canvas'}
              icon={
                isBookmarked ? (
                  <Icon name={'favorite'} type={'mono'} size={'lg'} />
                ) : (
                  <Icon name={'star'} type={'default'} size={'lg'} />
                )
              }
              tooltip={'Bookmark'}
              onClick={toggleBookmark}
            />
            {trail.state.embedded && (
              <LinkButton
                href={getUrlForTrail(trail)}
                variant={'secondary'}
                onClick={() => reportExploreMetrics('selected_metric_action_clicked', { action: 'open_from_embedded' })}
              >
                Open
              </LinkButton>
            )}
          </Stack>
        </div>

        <TabsBar>
          {actionViewsDefinitions.map((tab, index) => {
            const label = tab.getDisplayName ? tab.getDisplayName(metricScene) : tab.displayName;
            const counter = tab.value === 'related_logs' ? metricScene.state.relatedLogsCount : undefined;

            const tabRender = (
              <Tab
                key={index}
                label={label}
                counter={counter}
                active={actionView === tab.value}
                onChangeTab={() => {
                  reportExploreMetrics('metric_action_view_changed', { view: tab.value });
                  metricScene.setActionView(tab.value);
                }}
              />
            );

            if (tab.description) {
              return (
                <Tooltip key={index} content={tab.description} placement="bottom-start" theme="info">
                  {tabRender}
                </Tooltip>
              );
            }
            return tabRender;
          })}
        </TabsBar>
      </Box>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    actions: css({
      [theme.breakpoints.up(theme.breakpoints.values.md)]: {
        position: 'absolute',
        right: 0,
        top: 16,
        zIndex: 2,
      },
    }),
  };
}

function getVariableSet(metric: string) {
  return new SceneVariableSet({
    variables: [
      ...getVariablesWithMetricConstant(metric),
      new QueryVariable({
        name: VAR_GROUP_BY,
        label: 'Group by',
        datasource: trailDS,
        includeAll: true,
        defaultToAll: true,
        query: { query: `label_names(${VAR_METRIC_EXPR})`, refId: 'A' },
        value: '',
        text: '',
      }),
    ],
  });
}
