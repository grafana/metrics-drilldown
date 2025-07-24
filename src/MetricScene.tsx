import { css } from '@emotion/css';
import { config } from '@grafana/runtime';
import {
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  SceneVariableSet,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { GroupByVariable } from 'Breakdown/GroupByVariable';
import { actionViews, actionViewsDefinitions, type ActionViewType } from 'MetricActionBar';

import { getAutoQueriesForMetric } from './autoQuery/getAutoQueriesForMetric';
import { type AutoQueryDef, type AutoQueryInfo } from './autoQuery/types';
import { MAIN_PANEL_MAX_HEIGHT, MAIN_PANEL_MIN_HEIGHT, MetricGraphScene } from './MetricGraphScene';
import { RelatedLogsOrchestrator } from './RelatedLogs/RelatedLogsOrchestrator';
import { RelatedLogsScene } from './RelatedLogs/RelatedLogsScene';
import { getVariablesWithMetricConstant, RefreshMetricsEvent, VAR_FILTERS, type MakeOptional } from './shared';

export interface MetricSceneState extends SceneObjectState {
  body: MetricGraphScene;
  metric: string;
  autoQuery: AutoQueryInfo;
  nativeHistogram?: boolean;
  actionView?: ActionViewType;
  queryDef?: AutoQueryDef;
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

    this.relatedLogsOrchestrator.findAndCheckAllDatasources();
    this.relatedLogsOrchestrator.addRelatedLogsCountChangeHandler((count) => {
      this.setState({ relatedLogsCount: count });
    });

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
      this.setActionView(null);
    }
  }

  public setActionView(actionViewType: ActionViewType | null) {
    const { body } = this.state;
    const actionViewDef = actionViewType ? actionViewsDefinitions.find((v) => v.value === actionViewType) : null;

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
    variables: [...getVariablesWithMetricConstant(metric), new GroupByVariable()],
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
