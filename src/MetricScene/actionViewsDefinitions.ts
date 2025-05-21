import { type SceneObject, type SceneObjectState } from '@grafana/scenes';

import { MetricSelectScene } from 'MetricSelect/MetricSelectScene';

import { buildLabelBreakdownActionScene } from './Breakdown/LabelBreakdownScene';
import { type MetricScene } from './MetricScene';

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
  { displayName: 'Breakdown', value: actionViews.breakdown, getScene: buildLabelBreakdownActionScene },
  {
    displayName: 'Related metrics',
    value: actionViews.related,
    getScene: () => new MetricSelectScene({}),
    description: 'Relevant metrics based on current label filters',
  },
  {
    displayName: 'Related logs',
    value: actionViews.relatedLogs,
    getScene: (metricScene: MetricScene) => metricScene.createRelatedLogsScene(),
    description: 'Relevant logs based on current label filters and time range',
  },
];
