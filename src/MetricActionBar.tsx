import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { Box, Stack, Tab, TabsBar, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { reportExploreMetrics } from 'interactions';
import { MetricScene } from 'MetricScene';
import { RelatedMetricsScene } from 'RelatedMetricsScene/RelatedMetricsScene';

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


  public static readonly Component = ({ model }: SceneComponentProps<MetricActionBar>) => {
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
    const styles = useStyles2(getStyles);
    const { actionView } = metricScene.useState();

    return (
      <Box paddingY={1} data-testid="action-bar">
        <div className={styles.actions}>
          <Stack gap={1}>
            {/* Action buttons moved to panel menu */}
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
