import { css } from '@emotion/css';
import { config } from '@grafana/runtime';
import {
  ConstantVariable,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  SceneVariableSet,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { RefreshMetricsEvent, VAR_FILTERS, VAR_METRIC, type MakeOptional } from '../shared/shared';
import { GroupByVariable } from './Breakdown/GroupByVariable';
import { EventActionViewDataLoadComplete } from './EventActionViewDataLoadComplete';
import { actionViews, actionViewsDefinitions, defaultActionView, type ActionViewType } from './MetricActionBar';
import { MetricGraphScene } from './MetricGraphScene';
import { RelatedLogsOrchestrator } from './RelatedLogs/RelatedLogsOrchestrator';
import { RelatedLogsScene } from './RelatedLogs/RelatedLogsScene';

interface MetricSceneState extends SceneObjectState {
  body: MetricGraphScene;
  metric: string;
  actionView?: ActionViewType;
  relatedLogsCount?: number;
}

export class MetricScene extends SceneObjectBase<MetricSceneState> {
  public readonly relatedLogsOrchestrator = new RelatedLogsOrchestrator(this);
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['actionView'] });
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS],
    onReferencedVariableValueChanged: () => {
      // When filters change, we need to re-check for related logs

      this.relatedLogsOrchestrator.handleFiltersChange();
    },
  });
  // Keeps track of which background tasks have run to avoid running them multiple times
  private backgroundTaskHasRun: Record<ActionViewType, boolean> = {
    [actionViews.breakdown]: false,
    [actionViews.related]: false,
    [actionViews.relatedLogs]: false,
    [actionViews.queryResults]: false,
  };

  public constructor(state: MakeOptional<MetricSceneState, 'body'>) {
    super({
      $variables: state.$variables ?? getVariableSet(state.metric),
      body: state.body ?? new MetricGraphScene({ metric: state.metric }),
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    if (this.state.actionView === undefined) {
      this.setActionView(defaultActionView);
    }

    this.relatedLogsOrchestrator.addRelatedLogsCountChangeHandler((count) => {
      this.setState({ relatedLogsCount: count });
    });

    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    if (config.featureToggles.enableScopesInMetricsExplore) {
      // Push the scopes change event to the tabs
      // The event is not propagated because the tabs are not part of the scene graph
      this.subscribeToEvent(RefreshMetricsEvent, (event) => {
        this.state.body.state.selectedTab?.publishEvent(event);
      });
    }

    // Register handler to wait for active tab's data load completion
    // This ensures the active tab has priority for data fetching
    this.subscribeToEvent(EventActionViewDataLoadComplete, (event) => {
      // Active tab has finished loading, safe to start background tasks like counting signals
      const inactiveTabs = actionViewsDefinitions.filter((v) => v.value !== event.payload.currentActionView);
      inactiveTabs.forEach(({ backgroundTask, value: tabName }) => {
        if (!this.backgroundTaskHasRun[tabName]) {
          backgroundTask(this);
          this.backgroundTaskHasRun[tabName] = true;
        }
      });
    });
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
      this.setActionView(null);
    }
  }

  public setActionView(actionViewType: ActionViewType | null) {
    const { body } = this.state;
    const actionViewDef = actionViewType ? actionViewsDefinitions.find((v) => v.value === actionViewType) : null;

    if (actionViewDef && actionViewDef.value !== this.state.actionView) {
      body.setState({ selectedTab: actionViewDef.getScene(this) });
      this.setState({ actionView: actionViewDef.value });
    } else {
      body.setState({ selectedTab: undefined });
      this.setState({ actionView: undefined });
    }
  }

  public getActionViewName(): string {
    return this.state.actionView
      ? actionViewsDefinitions.find((v) => v.value === this.state.actionView)?.displayName ?? ''
      : '';
  }

  static readonly Component = ({ model }: SceneComponentProps<MetricScene>) => {
    const { body } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container} data-testid="metric-scene">
        <body.Component model={body} />
      </div>
    );
  };

  public createRelatedLogsScene(): SceneObject<SceneObjectState> {
    return new RelatedLogsScene({
      orchestrator: this.relatedLogsOrchestrator,
    });
  }
}

function getVariableSet(metric: string) {
  return new SceneVariableSet({
    variables: [
      new ConstantVariable({
        name: VAR_METRIC,
        value: metric,
        hide: VariableHide.hideVariable,
      }),
      new GroupByVariable(),
    ],
  });
}

const getStyles = () => ({
  container: css({
    position: 'relative',
    height: '100%',
    width: '100%',
    // Ensure proper flex behavior for sticky positioning
    display: 'flex',
    flexDirection: 'column',
  }),
});
