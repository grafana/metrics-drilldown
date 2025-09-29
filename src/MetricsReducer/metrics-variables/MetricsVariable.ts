import { VariableHide, VariableRefresh, VariableSort } from '@grafana/data';
import {
  AdHocFiltersVariable,
  DataSourceVariable,
  QueryVariable,
  sceneGraph,
  type SceneObjectState,
} from '@grafana/scenes';

import { type LabelMatcher } from 'shared/GmdVizPanel/buildQueryExpression';
import { trailDS, VAR_DATASOURCE } from 'shared/shared';
import { getTrailFor } from 'shared/utils/utils';

import { VAR_METRICS_VAR_FILTERS } from './AdHocFiltersForMetricsVariable';
import { withLifecycleEvents } from './withLifecycleEvents';

export const VAR_METRICS_VARIABLE = 'metrics-wingman';

export type MetricOptions = Array<{ label: string; value: string }>;

interface MetricsVariableState extends SceneObjectState {
  key?: string;
  name?: string;
  labelMatcher?: LabelMatcher;
  addLifeCycleEvents?: boolean;
}

export class MetricsVariable extends QueryVariable {
  private extraFilter?: string;

  constructor({ key, name, labelMatcher, addLifeCycleEvents }: MetricsVariableState = {}) {
    super({
      key: key || VAR_METRICS_VARIABLE,
      name: name || VAR_METRICS_VARIABLE,
      label: 'Metrics',
      datasource: trailDS,
      query: '',
      refresh: VariableRefresh.never,
      includeAll: true,
      value: '$__all',
      skipUrlSync: true,
      sort: VariableSort.alphabeticalAsc,
      hide: VariableHide.hideVariable,
    });

    this.extraFilter = labelMatcher ? `${labelMatcher.key}${labelMatcher.operator}"${labelMatcher.value}"` : undefined;

    this.addActivationHandler(this.onActivate.bind(this));

    if (addLifeCycleEvents) {
      // required for filtering and sorting
      return withLifecycleEvents<MetricsVariable>(this);
    }
  }

  private onActivate() {
    this.toggleRecentMetrics();

    this._subs.add(
      sceneGraph.findByKeyAndType(this, VAR_DATASOURCE, DataSourceVariable).subscribeToState((newState, prevState) => {
        if (!this.state.query && newState.value !== prevState.value) {
          this.toggleRecentMetrics();
        }
      })
    );

    this._subs.add(
      sceneGraph
        .findByKeyAndType(this, VAR_METRICS_VAR_FILTERS, AdHocFiltersVariable)
        .subscribeToState((newState, prevState) => {
          if (!this.state.query && newState.filterExpression !== prevState.filterExpression) {
            this.toggleRecentMetrics();
          }
        })
    );
  }

  public toggleRecentMetrics() {
    // see side bar sections in SideBar.tsx and RecentMetricsSection.tsx
    const recentOffset = new URLSearchParams(window.location.search).get('filters-recent');

    if (recentOffset) {
      this.fetchRecentMetrics(recentOffset);
    } else {
      this.fetchAllMetrics();
    }
  }

  public fetchAllMetrics() {
    this.setState({
      query: this.extraFilter
        ? `label_values({${this.extraFilter},$${VAR_METRICS_VAR_FILTERS}}, __name__)`
        : `label_values({$${VAR_METRICS_VAR_FILTERS}}, __name__)`,
      refresh: VariableRefresh.onTimeRangeChanged,
    });

    this.refreshOptions();
  }

  public async fetchRecentMetrics(interval: string) {
    this.setState({
      query: '',
      refresh: VariableRefresh.never,
      options: [],
      loading: true,
      error: null,
    });

    try {
      const recentMetrics = await getTrailFor(this).fetchRecentMetrics({ interval, extraFilter: this.extraFilter });

      this.setState({
        loading: false,
        options: recentMetrics.map((value) => ({ value, label: value })),
      });
    } catch (error) {
      this.setState({ loading: false, error });
    }
  }
}
