import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  SceneObjectStateChangedEvent,
  sceneUtils,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { Box, Icon, Stack, Tab, TabsBar, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';
import { debounce } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';

import { genBookmarkKey } from 'bookmarks/genBookmarkKey';
import { useBookmarks } from 'bookmarks/useBookmarks';
import { UI_TEXT } from 'constants/ui';
import { type DataTrail } from 'DataTrail';
import { reportExploreMetrics } from 'interactions';
import { MetricScene } from 'MetricScene';
import { RelatedMetricsScene } from 'RelatedMetricsScene/RelatedMetricsScene';
import { ShareTrailButton } from 'ShareTrailButton';
import { getTrailFor } from 'utils';

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
