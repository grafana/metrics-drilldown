import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  getExploreURL,
  sceneGraph,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { Box, Icon, LinkButton, Stack, Tab, TabsBar, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { getPanelData } from 'AddToDashboard/utils';
import { AutoVizPanel } from 'autoQuery/components/AutoVizPanel';
import { UI_TEXT } from 'constants/ui';
import { reportExploreMetrics } from 'interactions';
import { METRIC_AUTOVIZPANEL_KEY } from 'MetricGraphScene';
import { MetricScene } from 'MetricScene';
import { RelatedMetricsScene } from 'RelatedMetricsScene/RelatedMetricsScene';
import { MetricSelectedEvent, PanelDataRequestEvent, type PanelDataRequestPayload } from 'shared';
import { ShareTrailButton } from 'ShareTrailButton';
import { useBookmarkState } from 'TrailStore/useBookmarkState';
import { getTrailFor, getUrlForTrail } from 'utils';
import { displayError } from 'WingmanDataTrail/helpers/displayStatus';

import { LabelBreakdownScene } from './Breakdown/LabelBreakdownScene';

export const actionViews = {
  breakdown: 'breakdown',
  related: 'related',
  relatedLogs: 'logs',
} as const;

export type ActionViewType = (typeof actionViews)[keyof typeof actionViews];

interface ActionViewDefinition {
  displayName: string;
  value: ActionViewType;
  description?: string;
  getScene: (metricScene: MetricScene) => SceneObject<SceneObjectState>;
}

export const actionViewsDefinitions: ActionViewDefinition[] = [
  {
    displayName: 'Breakdown',
    value: actionViews.breakdown,
    getScene: () => new LabelBreakdownScene({}),
  },
  {
    displayName: 'Related metrics',
    value: actionViews.related,
    getScene: (metricScene: MetricScene) => new RelatedMetricsScene({ metric: metricScene.state.metric }),
    description: 'Relevant metrics based on current label filters',
  },
  {
    displayName: 'Related logs',
    value: actionViews.relatedLogs,
    getScene: (metricScene: MetricScene) => metricScene.createRelatedLogsScene(),
    description: 'Relevant logs based on current label filters and time range',
  },
];

interface MetricActionBarState extends SceneObjectState {}

export class MetricActionBar extends SceneObjectBase<MetricActionBarState> {
  private _isAddToDashboardServiceAvailable(): boolean {
    try {
      // @ts-ignore - accessing getAddToDashboardService dynamically
      const { getAddToDashboardService } = require('@grafana/runtime');
      return typeof getAddToDashboardService === 'function' && getAddToDashboardService() != null;
    } catch {
      return false;
    }
  }

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

  public getMetricScenePanelData = (): PanelDataRequestPayload => {
    const autoVizPanel = sceneGraph.findByKeyAndType(this, METRIC_AUTOVIZPANEL_KEY, AutoVizPanel);
    
    if (!autoVizPanel.state.panel) {
      throw new Error('Panel not yet initialized');
    }

    const vizPanel = autoVizPanel.state.panel;

    return getPanelData(vizPanel);
  }

  public onGetPanelData = () => {
    try {
      const panelData = this.getMetricScenePanelData();
      // Fire the event with panel data to trigger the modal
      const trail = getTrailFor(this);
      trail.publishEvent(new PanelDataRequestEvent(panelData), true);
    } catch (error) {
      displayError(error as Error, ['Failed to retrieve panel data. Please check the console for more details.']);
    }
  };

  public static readonly Component = ({ model }: SceneComponentProps<MetricActionBar>) => {
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
    const styles = useStyles2(getStyles);
    const trail = getTrailFor(model);
    const [isBookmarked, toggleBookmark] = useBookmarkState(trail);
    const { actionView } = metricScene.useState();

    return (
      <Box paddingY={1} data-testid="action-bar">
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
            {model._isAddToDashboardServiceAvailable() && (
              <ToolbarButton
                variant={'canvas'}
                icon="panel-add"
                tooltip="Add to dashboard"
                onClick={model.onGetPanelData}
              />
            )}
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
            const isActive = actionView === tab.value;

            const tabRender = (
              <Tab
                key={index}
                label={label}
                counter={counter}
                active={isActive}
                onChangeTab={() => {
                  if (isActive) {
                    return;
                  }

                  reportExploreMetrics('metric_action_view_changed', {
                    view: tab.value,
                    related_logs_count: metricScene.relatedLogsOrchestrator.checkConditionsMetForRelatedLogs()
                      ? counter
                      : undefined,
                  });

                  metricScene.setActionView(tab.value);
                }}
              />
            );

            if (tab.description) {
              return (
                <Tooltip key={index} content={tab.description} placement="top" theme="info">
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
