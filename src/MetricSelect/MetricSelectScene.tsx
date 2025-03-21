import { isFetchError } from '@grafana/runtime';
import {
  SceneCSSGridLayout,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneCSSGridItem,
  type SceneFlexLayout,
  type SceneObjectState,
  type SceneObjectUrlValues,
  type SceneObjectWithUrlSync,
} from '@grafana/scenes';
import { debounce } from 'lodash';
import React from 'react';

import { getMetricNames } from './api';
import { MetricSelectedEvent, RefreshMetricsEvent, VAR_DATASOURCE, VAR_FILTERS } from '../shared';
import { StatusWrapper } from '../StatusWrapper';
import { getTrailFor } from '../utils';
import { isSceneCSSGridLayout, isSceneFlexLayout } from '../utils/utils.layout';

export interface MetricSelectSceneState extends SceneObjectState {
  metricPrefix?: string;
  body: SceneCSSGridLayout | SceneFlexLayout;
  metricNames?: string[];
  metricNamesLoading?: boolean;
  metricNamesError?: string;
  metricNamesWarning?: string;
}

const ROW_PREVIEW_HEIGHT = '175px';
const METRIC_PREFIX_ALL = 'all';
const MAX_METRIC_NAMES = 20000;

export class MetricSelectScene extends SceneObjectBase<MetricSelectSceneState> implements SceneObjectWithUrlSync {
  private ignoreNextUpdate = false;
  private _debounceRefreshMetricNames = debounce(() => this._refreshMetricNames(), 1000);

  static Component = ({ model }: SceneComponentProps<MetricSelectScene>) => {
    const { body, metricNamesLoading, metricNamesError } = model.useState();

    const renderBody = () => {
      if (!body) {
        return null;
      }
      if (isSceneFlexLayout(body)) {
        return <body.Component model={body} />;
      }
      if (isSceneCSSGridLayout(body)) {
        return <body.Component model={body} />;
      }
      return null;
    };

    return (
      <StatusWrapper isLoading={metricNamesLoading} blockingMessage={metricNamesError}>
        {renderBody()}
      </StatusWrapper>
    );
  };

  constructor(state: Partial<MetricSelectSceneState>) {
    super({
      $variables: state.$variables,
      metricPrefix: state.metricPrefix ?? METRIC_PREFIX_ALL,
      body:
        state.body ??
        new SceneCSSGridLayout({
          children: [],
          templateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
          autoRows: ROW_PREVIEW_HEIGHT,
          isLazy: true,
        }),
      ...state,
    });

    this.addActivationHandler(() => this._onActivate());
  }

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metricPrefix'] });
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_FILTERS],
    onReferencedVariableValueChanged: () => {
      this._debounceRefreshMetricNames();
    },
  });

  getUrlState() {
    return {};
  }

  updateFromUrl(values: SceneObjectUrlValues) {}

  updateMetricPanel(metric: string, isPanel: boolean, isEmpty: boolean) {
    const { body } = this.state;
    if (!body || !isSceneCSSGridLayout(body)) {
      return;
    }

    const panel = body.state.children.find((child) => child.state.key === metric) as SceneCSSGridItem | undefined;

    if (panel) {
      const newState = {
        ...panel.state,
        key: metric,
        hidden: isEmpty,
      };
      panel.setState(newState);
    }
  }

  private _onActivate() {
    const trail = getTrailFor(this);
    const { metric } = trail.state;

    if (metric) {
      this._handleMetricSelected(metric);
    } else {
      this._refreshMetricNames();
    }

    this.subscribeToState((n, p) => this._onStateChanged(n, p));
  }

  private _onStateChanged(newState: MetricSelectSceneState, prevState: MetricSelectSceneState) {
    if (this.ignoreNextUpdate) {
      this.ignoreNextUpdate = false;
      return;
    }

    if (newState.metricPrefix !== prevState.metricPrefix) {
      this._refreshMetricNames();
    }
  }

  private _handleMetricSelected(metric: string) {
    const trail = getTrailFor(this);
    const { metric: prevMetric } = trail.state;

    if (metric === prevMetric) {
      return;
    }

    trail.setState({ metric });
    this.publishEvent(new MetricSelectedEvent(metric));
  }

  private async _refreshMetricNames() {
    const trail = getTrailFor(this);
    const { metricPrefix } = this.state;
    const { $timeRange } = trail.state;
    const timeRange = $timeRange?.state;
    const datasourceUid = trail.state.$variables?.getByName(VAR_DATASOURCE)?.getValue();

    if (!timeRange || !datasourceUid || typeof datasourceUid !== 'string') {
      return;
    }

    this.setState({ metricNamesLoading: true });

    try {
      const response = await getMetricNames(datasourceUid, timeRange, [], [], [], [], MAX_METRIC_NAMES);

      let metricNames = response.data;
      if (metricPrefix && metricPrefix !== METRIC_PREFIX_ALL) {
        const prefixRegex = new RegExp(`(^${metricPrefix}.*)`, 'igy');
        metricNames = metricNames.filter((metric: string) => !prefixRegex || prefixRegex.test(metric));
      }

      if (metricNames.length > MAX_METRIC_NAMES) {
        this.setState({
          metricNamesWarning: `Found ${metricNames.length} metrics. Only showing first ${MAX_METRIC_NAMES}.`,
        });
        metricNames = metricNames.slice(0, MAX_METRIC_NAMES);
      }

      this.setState({
        metricNames,
        metricNamesLoading: false,
        metricNamesError: undefined,
        metricNamesWarning: response.limitReached
          ? `This feature will only return up to ${MAX_METRIC_NAMES} metric names for performance reasons.`
          : undefined,
      });

      this.publishEvent(new RefreshMetricsEvent());
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        this.setState({
          metricNamesError: isFetchError(error) ? error.data.message : error.message,
          metricNamesLoading: false,
        });
      }
    }
  }
}
