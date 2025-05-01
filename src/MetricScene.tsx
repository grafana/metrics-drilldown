import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  getExploreURL,
  QueryVariable,
  sceneGraph,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  SceneVariableSet,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { Box, Icon, LinkButton, Stack, Tab, TabsBar, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { buildRelatedMetricsScene } from './ActionTabs/RelatedMetricsScene';
import { AutoVizPanel } from './autoQuery/components/AutoVizPanel';
import { getAutoQueriesForMetric } from './autoQuery/getAutoQueriesForMetric';
import { type AutoQueryDef, type AutoQueryInfo } from './autoQuery/types';
import { buildLabelBreakdownActionScene } from './Breakdown/LabelBreakdownScene';
import { UI_TEXT } from './constants/ui';
import { reportExploreMetrics, type Interactions } from './interactions';
import {
  MAIN_PANEL_MAX_HEIGHT,
  MAIN_PANEL_MIN_HEIGHT,
  METRIC_AUTOVIZPANEL_KEY,
  MetricGraphScene,
} from './MetricGraphScene';
import { RelatedLogsOrchestrator } from './RelatedLogs/RelatedLogsOrchestrator';
import { buildRelatedLogsScene } from './RelatedLogs/RelatedLogsScene';
import {
  getVariablesWithMetricConstant,
  MetricSelectedEvent,
  RefreshMetricsEvent,
  trailDS,
  VAR_FILTERS,
  VAR_GROUP_BY,
  VAR_METRIC_EXPR,
  type MakeOptional,
} from './shared';
import { ShareTrailButton } from './ShareTrailButton';
import { useBookmarkState } from './TrailStore/useBookmarkState';
import { getTrailFor, getUrlForTrail } from './utils';

const relatedLogsFeatureEnabled = config.featureToggles.exploreMetricsRelatedLogs;

export interface MetricSceneState extends SceneObjectState {
  body: MetricGraphScene;
  metric: string;
  autoQuery: AutoQueryInfo;
  nativeHistogram?: boolean;
  actionView?: ActionViewType;
  queryDef?: AutoQueryDef;
  relatedLogsCount?: number;
}

export const actionViews = {
  breakdown: 'breakdown',
  related: 'related',
  relatedLogs: 'logs',
} as const;

export type ActionViewType = (typeof actionViews)[keyof typeof actionViews];

export class MetricScene extends SceneObjectBase<MetricSceneState> {
  public readonly relatedLogsOrchestrator = new RelatedLogsOrchestrator(this);
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['actionView'] });
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS],
    onReferencedVariableValueChanged: () => {
      // When filters change, we need to re-check for related logs
      if (relatedLogsFeatureEnabled) {
        this.relatedLogsOrchestrator.handleFiltersChange();
      }
    },
  });

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
      this.setActionView(actionViews.breakdown);
    }

    if (relatedLogsFeatureEnabled) {
      this.relatedLogsOrchestrator.findAndCheckAllDatasources();
      this.relatedLogsOrchestrator.addRelatedLogsCountChangeHandler((count) => {
        this.setState({ relatedLogsCount: count });
      });
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
    const { body } = this.state;
    const actionViewDef = actionViewsDefinitions.find((v) => v.value === actionView);

    if (actionViewDef && actionViewDef.value !== this.state.actionView) {
      // reduce max height for main panel to reduce height flicker
      body.state.topView.state.children[0].setState({ maxHeight: MAIN_PANEL_MIN_HEIGHT });
      body.setState({ selectedTab: actionViewDef.getScene(this) });
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
    return (
      <div data-testid="metric-scene">
        <body.Component model={body} />
      </div>
    );
  };

  public createRelatedLogsScene(): SceneObject<SceneObjectState> {
    return buildRelatedLogsScene({
      orchestrator: this.relatedLogsOrchestrator,
    });
  }
}

interface ActionViewDefinition {
  displayName: string;
  value: ActionViewType;
  description?: string;
  getScene: (metricScene: MetricScene) => SceneObject<SceneObjectState>;
}

const actionViewsDefinitions: ActionViewDefinition[] = [
  { displayName: 'Breakdown', value: actionViews.breakdown, getScene: buildLabelBreakdownActionScene },
  {
    displayName: 'Related metrics',
    value: actionViews.related,
    getScene: buildRelatedMetricsScene,
    description: 'Relevant metrics based on current label filters',
  },
];

if (relatedLogsFeatureEnabled) {
  actionViewsDefinitions.push({
    displayName: 'Related logs',
    value: actionViews.relatedLogs,
    getScene: (metricScene: MetricScene) => metricScene.createRelatedLogsScene(),
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
      <Box paddingY={1} data-testid="metric-scene-details">
        <div className={styles.actions}>
          <Stack gap={1}>
            <ToolbarButton
              variant={'canvas'}
              tooltip={UI_TEXT.METRIC_SELECT_SCENE.SELECT_NEW_METRIC_TOOLTIP}
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
              tooltip={UI_TEXT.METRIC_SELECT_SCENE.OPEN_EXPLORE_LABEL}
              onClick={model.openExploreLink}
            />
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
              tooltip={UI_TEXT.METRIC_SELECT_SCENE.BOOKMARK_LABEL}
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

        <TabsBar className={styles.customTabsBar}>
          {actionViewsDefinitions.map((tab, index) => {
            const label = tab.displayName;
            const counter = tab.value === actionViews.relatedLogs ? metricScene.state.relatedLogsCount : undefined;

            const tabRender = (
              <Tab
                key={index}
                label={label}
                counter={counter}
                active={actionView === tab.value}
                onChangeTab={() => {
                  const actionViewChangedPayload: Interactions['metric_action_view_changed'] = { view: tab.value };

                  if (
                    relatedLogsFeatureEnabled &&
                    metricScene.relatedLogsOrchestrator.checkConditionsMetForRelatedLogs()
                  ) {
                    actionViewChangedPayload.related_logs_count = counter;
                  }

                  reportExploreMetrics('metric_action_view_changed', actionViewChangedPayload);
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
    customTabsBar: css({
      paddingBottom: theme.spacing(1),
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
