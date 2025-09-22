import { LoadingState, type DataFrame, type PanelData } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneDataProvider,
  type SceneLayout,
  type SceneObject,
  type SceneObjectState,
  type SceneStatelessBehavior,
} from '@grafana/scenes';
import React from 'react';

import { sortSeries, type SortSeriesByOption } from 'services/sorting';
import { type CountsData } from 'WingmanDataTrail/ListControls/QuickSearch/CountsProvider/CountsProvider';
import { QuickSearch } from 'WingmanDataTrail/ListControls/QuickSearch/QuickSearch';

import { getLabelValueFromDataFrame } from './getLabelValueFromDataFrame';
import { SortBySelector } from './SortBySelector';
import { EventForceSyncYAxis } from '../MetricLabelsList/events/EventForceSyncYAxis';
import { EventResetSyncYAxis } from '../MetricLabelsList/events/EventResetSyncYAxis';

/**
 * Same idea as in our custom SceneByVariableRepeater.tsx, we create a Scene object with more capabilities than the official Scene object.
 * Specifically, we're adding:
 *
 * 1. Support for pagination
 * 2. Support for filtering and sorting (we may consider externalizing this to a separate class in the future)
 * 3. Support for $behaviors, that is used to reset the y axis sync after filtering and/or sorting
 */
interface SceneByFrameRepeaterState extends SceneObjectState {
  $behaviors: Array<SceneObject | SceneStatelessBehavior>;
  body: SceneLayout;
  getLayoutChild(data: PanelData, frame: DataFrame, frameIndex: number): SceneObject | null;
  getLayoutLoading?: () => SceneObject;
  getLayoutError?: (data: PanelData) => SceneObject;
  getLayoutEmpty?: () => SceneObject;
  currentBatchSize: number;
  initialPageSize: number;
  pageSizeIncrement: number;
  loadingLayout?: SceneObject;
  errorLayout?: SceneObject;
  emptyLayout?: SceneObject;
  counts: CountsData;
  $data?: SceneDataProvider;
}

const DEFAULT_INITIAL_PAGE_SIZE = 120;
const DEFAULT_PAGE_SIZE_INCREMENT = 9;

export class SceneByFrameRepeater extends SceneObjectBase<SceneByFrameRepeaterState> {
  private searchText = '';
  private sortBy?: SortSeriesByOption;

  public constructor({
    $behaviors,
    body,
    getLayoutChild,
    getLayoutLoading,
    getLayoutError,
    getLayoutEmpty,
    initialPageSize,
    pageSizeIncrement,
    $data,
  }: {
    $behaviors: SceneByFrameRepeaterState['$behaviors'];
    body: SceneByFrameRepeaterState['body'];
    getLayoutChild: SceneByFrameRepeaterState['getLayoutChild'];
    getLayoutLoading?: SceneByFrameRepeaterState['getLayoutLoading'];
    getLayoutError?: SceneByFrameRepeaterState['getLayoutError'];
    getLayoutEmpty?: SceneByFrameRepeaterState['getLayoutEmpty'];
    initialPageSize?: SceneByFrameRepeaterState['initialPageSize'];
    pageSizeIncrement?: SceneByFrameRepeaterState['pageSizeIncrement'];
    $data?: SceneByFrameRepeaterState['$data'];
  }) {
    super({
      key: 'breakdown-by-frame-repeater',
      $behaviors,
      body,
      getLayoutChild,
      getLayoutLoading,
      getLayoutError,
      getLayoutEmpty,
      currentBatchSize: 0,
      initialPageSize: initialPageSize || DEFAULT_INITIAL_PAGE_SIZE,
      pageSizeIncrement: pageSizeIncrement || DEFAULT_PAGE_SIZE_INCREMENT,
      loadingLayout: undefined,
      errorLayout: undefined,
      emptyLayout: undefined,
      counts: { current: 0, total: 0 },
      $data,
    });

    this.addActivationHandler(() => {
      const dataProvider = sceneGraph.getData(this);
      if (!dataProvider) {
        throw new Error('No data provider found!');
      }

      this.initFilterAndSort();

      this._subs.add(
        dataProvider.subscribeToState((newState) => {
          if (newState.data) {
            this.performRepeat(newState.data);
          }
        })
      );

      if (dataProvider.state.data) {
        this.performRepeat(dataProvider.state.data);
      }
    });
  }

  private performRepeat(data: PanelData) {
    if (data.state === LoadingState.Loading) {
      this.setState({
        loadingLayout: this.state.getLayoutLoading?.(),
        errorLayout: undefined,
        emptyLayout: undefined,
        currentBatchSize: 0,
      });
      return;
    }

    if (data.state === LoadingState.Error) {
      this.setState({
        errorLayout: this.state.getLayoutError?.(data),
        loadingLayout: undefined,
        emptyLayout: undefined,
        currentBatchSize: 0,
      });
      return;
    }

    const filteredSeries = this.filterAndSort(data.series);

    if (!filteredSeries.length) {
      this.setState({
        emptyLayout: this.state.getLayoutEmpty?.(),
        errorLayout: undefined,
        loadingLayout: undefined,
        currentBatchSize: 0,
        counts: { current: 0, total: data.series.length },
      });
      return;
    }

    this.setState({
      loadingLayout: undefined,
      errorLayout: undefined,
      emptyLayout: undefined,
      currentBatchSize: this.state.initialPageSize,
      counts: { current: filteredSeries.length, total: data.series.length },
    });

    const newChildren: SceneObject[] = filteredSeries
      .slice(0, this.state.initialPageSize)
      .map((s, i) => this.state.getLayoutChild(data, s, i))
      .filter(Boolean) as SceneObject[];

    this.state.body.setState({ children: newChildren });
  }

  private initFilterAndSort() {
    this.searchText = sceneGraph.findByKeyAndType(this, 'quick-search', QuickSearch).state.value;
    this.sortBy = sceneGraph.findByKeyAndType(this, 'breakdown-sort-by', SortBySelector).state.value.value;
  }

  private filterAndSort(series: PanelData['series']) {
    let filteredSeries: DataFrame[] = [];

    if (!this.searchText) {
      filteredSeries = series;
    } else {
      const regexes = this.searchText
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((r) => {
          try {
            return new RegExp(r);
          } catch {
            return null;
          }
        })
        .filter(Boolean) as RegExp[];

      for (let i = 0; i < series.length; i += 1) {
        const s = series[i];

        if (regexes.some((regex) => regex.test(getLabelValueFromDataFrame(s)))) {
          filteredSeries.push(s);
        }
      }
    }

    if (this.sortBy) {
      filteredSeries = sortSeries(filteredSeries, this.sortBy);
    }

    return filteredSeries;
  }

  public filter(searchText: string) {
    this.searchText = searchText;

    const { data } = sceneGraph.getData(this).state;
    if (data) {
      this.publishEvent(new EventResetSyncYAxis({}), true);
      this.performRepeat(data);
    }
  }

  public sort(sortBy: SortSeriesByOption) {
    this.sortBy = sortBy;

    const { data } = sceneGraph.getData(this).state;
    if (data) {
      this.publishEvent(new EventResetSyncYAxis({}), true);
      this.performRepeat(data);
    }
  }

  public increaseBatchSize() {
    const { data } = sceneGraph.getData(this).state;
    if (!data) {
      return;
    }

    const newBatchSize = this.state.currentBatchSize + this.state.pageSizeIncrement;

    const newChildren: SceneObject[] = this.filterAndSort(data.series)
      .slice(this.state.currentBatchSize, newBatchSize)
      .map((s, i) => this.state.getLayoutChild(data, s, i))
      .filter(Boolean) as SceneObject[];

    this.state.body.setState({
      children: [...this.state.body.state.children, ...newChildren],
    });

    this.setState({
      currentBatchSize: newBatchSize,
    });

    this.publishEvent(new EventForceSyncYAxis({}), true);
  }

  public useSizes() {
    const { currentBatchSize, pageSizeIncrement } = this.useState();
    const { data } = sceneGraph.getData(this).state;
    const total = data ? this.filterAndSort(data.series).length : 0;
    const remaining = total - currentBatchSize;
    const increment = remaining < pageSizeIncrement ? remaining : pageSizeIncrement;

    return {
      increment,
      current: currentBatchSize,
      total,
    };
  }

  public getCounts() {
    const { data } = sceneGraph.getData(this).state;
    return {
      current: 0,
      total: data ? data.series.length : 0,
    };
  }

  public static readonly Component = ({ model }: SceneComponentProps<SceneByFrameRepeater>) => {
    const { body, loadingLayout, errorLayout, emptyLayout } = model.useState();

    if (loadingLayout) {
      return <loadingLayout.Component model={loadingLayout} />;
    }

    if (errorLayout) {
      return <errorLayout.Component model={errorLayout} />;
    }

    if (emptyLayout) {
      return <emptyLayout.Component model={emptyLayout} />;
    }

    return <body.Component model={body} />;
  };
}
