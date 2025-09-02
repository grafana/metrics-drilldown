import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  getExploreURL,
  sceneGraph,
  SceneObjectBase,
  SceneObjectStateChangedEvent,
  SceneQueryRunner,
  sceneUtils,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { Box, Icon, LinkButton, Stack, Tab, TabsBar, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';
import { debounce } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';

import { genBookmarkKey } from 'bookmarks/genBookmarkKey';
import { useBookmarks } from 'bookmarks/useBookmarks';
import { UI_TEXT } from 'constants/ui';
import { type DataTrail } from 'DataTrail';
import { createAppUrl } from 'extensions/links';
import { GmdVizPanel } from 'GmdVizPanel/GmdVizPanel';
import { reportExploreMetrics } from 'interactions';
import { TOPVIEW_KEY } from 'MetricGraphScene';
import { MetricScene } from 'MetricScene';
import { RelatedMetricsScene } from 'RelatedMetricsScene/RelatedMetricsScene';
import { MetricSelectedEvent } from 'shared';
import { ShareTrailButton } from 'ShareTrailButton';
import { getTrailFor, getUrlForTrail } from 'utils';

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
    getScene: (metricScene: MetricScene) => new LabelBreakdownScene({ metric: metricScene.state.metric }),
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
  public getLinkToExplore = async () => {
    const topView = sceneGraph.findByKey(this, TOPVIEW_KEY);
    const vizPanel = sceneGraph.findDescendents(topView, GmdVizPanel)[0];
    const queryRunner = sceneGraph.findDescendents(vizPanel, SceneQueryRunner)[0];
    const panelData = queryRunner.state.data;

    if (!panelData) {
      throw new Error('Cannot get link to explore, no panel data found');
    }

    const metricScene = sceneGraph.getAncestor(this, MetricScene);
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

  private useBookmarkState = (trail: DataTrail) => {
    const { bookmarks, addBookmark, removeBookmark } = useBookmarks(this);
    const [currentKey, setCurrentKey] = useState<string>();
    const isBookmarked = useMemo(() => bookmarks.some((b) => b.key === currentKey), [bookmarks, currentKey]);

    useEffect(() => {
      const sub = trail.subscribeToEvent(
        SceneObjectStateChangedEvent,
        // debounce to prevent generating a lot of keys for nothing
        debounce(() => setCurrentKey(genBookmarkKey(sceneUtils.getUrlState(trail))), 100)
      );

      return () => sub.unsubscribe();
    }, [trail]);

    const toggleBookmark = () => {
      reportExploreMetrics('bookmark_changed', { action: isBookmarked ? 'toggled_off' : 'toggled_on' });

      if (!isBookmarked) {
        addBookmark();
        return;
      }

      if (currentKey) {
        removeBookmark(currentKey);
      }
    };

    return { isBookmarked, toggleBookmark };
  };

  public static readonly Component = ({ model }: SceneComponentProps<MetricActionBar>) => {
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
    const styles = useStyles2(getStyles);
    const trail = getTrailFor(model);
    const { isBookmarked, toggleBookmark } = model.useBookmarkState(trail);
    const { actionView } = metricScene.useState();

    return (
      <Box paddingY={1} data-testid="action-bar">
        <div className={styles.actions}>
          <Stack gap={1}>
            {trail.state.embedded ? (
              <LinkButton
                href={createAppUrl(getUrlForTrail(trail))}
                variant={'secondary'}
                icon="arrow-right"
                tooltip="Open in Metrics Drilldown"
                onClick={() => reportExploreMetrics('selected_metric_action_clicked', { action: 'open_from_embedded' })}
              >
                Metrics Drilldown
              </LinkButton>
            ) : (
              <ToolbarButton
                variant={'canvas'}
                tooltip={UI_TEXT.METRIC_SELECT_SCENE.SELECT_NEW_METRIC_TOOLTIP}
                onClick={() => {
                  reportExploreMetrics('selected_metric_action_clicked', { action: 'unselect' });
                  trail.publishEvent(new MetricSelectedEvent({}));
                }}
              >
                Select new metric
              </ToolbarButton>
            )}
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
