import { LoadingState, type DataFrame, type PanelData } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneLayout,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import React from 'react';

import { getLabelValueFromDataFrame } from './getLabelValueFromDataFrame';
import { fuzzySearch } from '../../services/search';

/**
 * Same idea as in our cusotm SceneByVariableRepeater.tsx, we create a Scene object with more capabilities than the official Scene object.
 */
interface SceneByFrameRepeaterState extends SceneObjectState {
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
}

const DEFAULT_INITIAL_PAGE_SIZE = 120;
const DEFAULT_PAGE_SIZE_INCREMENT = 9;

export class SceneByFrameRepeater extends SceneObjectBase<SceneByFrameRepeaterState> {
  panelData: PanelData | null = null;
  filteredPanelData: PanelData | null = null;

  public constructor({
    body,
    getLayoutChild,
    getLayoutLoading,
    getLayoutError,
    getLayoutEmpty,
    initialPageSize,
    pageSizeIncrement,
  }: {
    body: SceneByFrameRepeaterState['body'];
    getLayoutChild: SceneByFrameRepeaterState['getLayoutChild'];
    getLayoutLoading?: SceneByFrameRepeaterState['getLayoutLoading'];
    getLayoutError?: SceneByFrameRepeaterState['getLayoutError'];
    getLayoutEmpty?: SceneByFrameRepeaterState['getLayoutEmpty'];
    initialPageSize?: SceneByFrameRepeaterState['initialPageSize'];
    pageSizeIncrement?: SceneByFrameRepeaterState['pageSizeIncrement'];
  }) {
    super({
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
    });

    this.addActivationHandler(() => {
      const dataProvider = sceneGraph.getData(this);

      if (!dataProvider) {
        throw new Error('No data provider found!');
      }

      this._subs.add(
        dataProvider.subscribeToState((newState) => {
          if (newState.data) {
            this.panelData = newState.data;

            if (!this.filteredPanelData) {
              this.filteredPanelData = this.panelData;
            }

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

    if (!data.series.length) {
      this.setState({
        emptyLayout: this.state.getLayoutEmpty?.(),
        errorLayout: undefined,
        loadingLayout: undefined,
        currentBatchSize: 0,
      });
      return;
    }

    this.setState({
      loadingLayout: undefined,
      errorLayout: undefined,
      emptyLayout: undefined,
      currentBatchSize: this.state.initialPageSize,
    });

    const newChildren: SceneObject[] = data.series
      .slice(0, this.state.initialPageSize)
      .map((s, index) => this.state.getLayoutChild(data, s, index))
      .filter(Boolean) as SceneObject[];

    this.state.body.setState({
      children: newChildren,
    });
  }

  // FIXME when searching then clicking on "Single" view, then back to (e.g.) "Grid"
  public filter(searchText: string) {
    if (!this.panelData) {
      return;
    }

    if (!searchText) {
      this.filteredPanelData = { ...this.panelData };
      this.performRepeat(this.panelData);
      return;
    }

    const series = this.panelData.series || [];
    const allValues = series.map((s) => getLabelValueFromDataFrame(s));

    fuzzySearch(allValues, searchText, ([searchResults]) => {
      const filteredSeries = searchResults?.length
        ? series.filter((s) => searchResults.includes(getLabelValueFromDataFrame(s)))
        : [];

      this.filteredPanelData = {
        ...this.panelData,
        series: filteredSeries,
      } as PanelData;

      this.performRepeat(this.filteredPanelData);
    });
  }

  // FIXME
  public increaseBatchSize() {
    const data = this.filteredPanelData;
    if (!data) {
      return;
    }

    const newBatchSize = this.state.currentBatchSize + this.state.pageSizeIncrement;

    const newChildren: SceneObject[] = data.series
      .slice(this.state.currentBatchSize, newBatchSize)
      .map((s, index) => this.state.getLayoutChild(data, s, this.state.currentBatchSize + index))
      .filter(Boolean) as SceneObject[];

    this.state.body.setState({
      children: [...this.state.body.state.children, ...newChildren],
    });

    this.setState({
      currentBatchSize: newBatchSize,
    });
  }

  public useSizes() {
    const data = this.filteredPanelData;

    const { currentBatchSize, pageSizeIncrement } = this.useState();
    const total = data ? data.series.length : 0;
    const remaining = total - currentBatchSize;
    const increment = remaining < pageSizeIncrement ? remaining : pageSizeIncrement;

    return {
      increment,
      current: currentBatchSize,
      total,
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
