import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { Box, Stack, Tab, TabsBar, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { reportExploreMetrics } from 'shared/tracking/interactions';

import { LabelBreakdownScene } from './Breakdown/LabelBreakdownScene';
import { MetricScene } from './MetricScene';
import { QueryResultsScene } from './QueryResults/QueryResultsScene';
import { RelatedMetricsScene } from './RelatedMetrics/RelatedMetricsScene';

export const actionViews = {
  breakdown: 'breakdown',
  related: 'related',
  relatedLogs: 'logs',
  queryResults: 'results',
} as const;

export const defaultActionView = actionViews.breakdown;

export type ActionViewType = (typeof actionViews)[keyof typeof actionViews];

interface ActionViewDefinition {
  displayName: string;
  value: ActionViewType;
  description?: string;
  getScene: (metricScene: MetricScene) => SceneObject<SceneObjectState>;
  backgroundTask: (metricScene: MetricScene) => void;
}

export function getActionViewsDefinitions(): ActionViewDefinition[] {
  return [
    {
      displayName: t('action-bar.tab.breakdown', 'Breakdown'),
      value: actionViews.breakdown,
      getScene: (metricScene: MetricScene) => new LabelBreakdownScene({ metric: metricScene.state.metric }),
      backgroundTask: () => {}, // TODO: Implement background task for breakdown (e.g. count breakdown panels)
    },
    {
      displayName: t('action-bar.tab.related-metrics', 'Related metrics'),
      value: actionViews.related,
      getScene: (metricScene: MetricScene) => new RelatedMetricsScene({ metric: metricScene.state.metric }),
      description: t('action-bar.tab.related-metrics-description', 'Relevant metrics based on current label filters'),
      backgroundTask: () => {}, // TODO: Implement background task for related metrics (e.g. count related metrics)
    },
    {
      displayName: t('action-bar.tab.related-logs', 'Related logs'),
      value: actionViews.relatedLogs,
      getScene: (metricScene: MetricScene) => metricScene.createRelatedLogsScene(),
      description: t(
        'action-bar.tab.related-logs-description',
        'Relevant logs based on current label filters and time range'
      ),
      backgroundTask: (metricScene: MetricScene) => metricScene.relatedLogsOrchestrator.findAndCheckAllDatasources(),
    },
    {
      displayName: t('action-bar.tab.query-results', 'Query Results'),
      value: actionViews.queryResults,
      getScene: (metricScene: MetricScene) =>
        new QueryResultsScene({
          metric: metricScene.state.metric,
          queryResultsComponent: metricScene.state.queryResultsComponent,
        }),
      description: t('action-bar.tab.query-results-description', 'Instant query data in table format'),
      backgroundTask: () => {},
    },
  ];
}

/** @deprecated Use getActionViewsDefinitions() instead */
export const actionViewsDefinitions: ActionViewDefinition[] = [
  {
    displayName: 'Breakdown',
    value: actionViews.breakdown,
    getScene: (metricScene: MetricScene) => new LabelBreakdownScene({ metric: metricScene.state.metric }),
    backgroundTask: () => {},
  },
  {
    displayName: 'Related metrics',
    value: actionViews.related,
    getScene: (metricScene: MetricScene) => new RelatedMetricsScene({ metric: metricScene.state.metric }),
    description: 'Relevant metrics based on current label filters',
    backgroundTask: () => {},
  },
  {
    displayName: 'Related logs',
    value: actionViews.relatedLogs,
    getScene: (metricScene: MetricScene) => metricScene.createRelatedLogsScene(),
    description: 'Relevant logs based on current label filters and time range',
    backgroundTask: (metricScene: MetricScene) => metricScene.relatedLogsOrchestrator.findAndCheckAllDatasources(),
  },
  {
    displayName: 'Query Results',
    value: actionViews.queryResults,
    getScene: (metricScene: MetricScene) =>
      new QueryResultsScene({
        metric: metricScene.state.metric,
        queryResultsComponent: metricScene.state.queryResultsComponent,
      }),
    description: 'Instant query data in table format',
    backgroundTask: () => {},
  },
];

interface MetricActionBarState extends SceneObjectState {}

export class MetricActionBar extends SceneObjectBase<MetricActionBarState> {
  public static readonly Component = ({ model }: SceneComponentProps<MetricActionBar>) => {
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
    const styles = useStyles2(getStyles);
    const { actionView, isQueryResultsAvailable } = metricScene.useState();
    const translatedActionViews = getActionViewsDefinitions().filter((tab) => {
      if (tab.value === actionViews.queryResults) {
        return isQueryResultsAvailable;
      }
      return true;
    });

    return (
      <Box paddingY={1} data-testid="action-bar" width="100%">
        <div className={styles.actions}>
          <Stack gap={1}>{/* Action buttons moved to panel menu */}</Stack>
        </div>

        <TabsBar className={styles.customTabsBar}>
          {translatedActionViews.map((tab, index) => {
            const label = tab.displayName;
            const isActive = actionView === tab.value;
            const counter = tab.value === actionViews.relatedLogs ? metricScene.state.relatedLogsCount : undefined;

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
