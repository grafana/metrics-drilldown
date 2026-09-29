import { LoadingState, type DataFrame, type PanelData } from '@grafana/data';
import {
  MultiValueVariable,
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

import { getMultiVariableValues } from 'MetricsReducer/components/SceneByVariableRepeater';
import { localeCompare } from 'MetricsReducer/helpers/localCompare';
import { type CountsData } from 'MetricsReducer/list-controls/QuickSearch/CountsProvider/CountsProvider';
import { QuickSearch } from 'MetricsReducer/list-controls/QuickSearch/QuickSearch';
import { sortSeries, type SortSeriesByOption } from 'shared/services/sorting';

import { getLabelValueFromDataFrame } from './getLabelValueFromDataFrame';
import { SortBySelector } from './SortBySelector';
import { EventForceSyncYAxis } from '../MetricLabelsList/events/EventForceSyncYAxis';
import { EventResetSyncYAxis } from '../MetricLabelsList/events/EventResetSyncYAxis';

export type LabelValueItem = {
  value: string;
  displayValue: string;
  frame?: DataFrame;
};

function getRawFrameLabelValue(frame: DataFrame): string {
  const value = getLabelValueFromDataFrame(frame);
  return value.startsWith('<unspecified') ? '' : value;
}

function getDisplayValue(value: string): string {
  return value === '' ? '<unspecified>' : value;
}

export function buildLabelValueItems(values: string[] | undefined, series: DataFrame[]): LabelValueItem[] {
  if (!values) {
    return series.map((frame) => {
      const value = getRawFrameLabelValue(frame);
      return { value, displayValue: getDisplayValue(value), frame };
    });
  }

  const framesByValue = new Map<string, DataFrame>();
  for (const frame of series) {
    const value = getRawFrameLabelValue(frame);
    if (!framesByValue.has(value)) {
      framesByValue.set(value, frame);
    }
  }

  return values.map((value) => ({
    value,
    displayValue: getDisplayValue(value),
    frame: framesByValue.get(value),
  }));
}

function matchesSearch(item: LabelValueItem, searchText: string): boolean {
  if (!searchText) {
    return true;
  }

  const regexes = searchText
    .split(',')
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .map((pattern) => {
      try {
        return new RegExp(pattern);
      } catch {
        return undefined;
      }
    })
    .filter((regex): regex is RegExp => Boolean(regex));

  return regexes.some((regex) => regex.test(item.displayValue));
}

export function filterAndSortLabelValueItems(
  items: LabelValueItem[],
  searchText: string,
  sortBy?: SortSeriesByOption
): LabelValueItem[] {
  const filtered = items.filter((item) => matchesSearch(item, searchText));

  if (sortBy === 'alphabetical' || sortBy === 'alphabetical-reversed') {
    const direction = sortBy === 'alphabetical' ? 1 : -1;
    return [...filtered].sort((a, b) => direction * localeCompare(a.displayValue, b.displayValue));
  }

  if (!sortBy) {
    return filtered;
  }

  const sampled = filtered.filter((item): item is LabelValueItem & { frame: DataFrame } => Boolean(item.frame));
  const missing = filtered.filter((item) => !item.frame).sort((a, b) => localeCompare(a.displayValue, b.displayValue));
  const sortedFrames = sortSeries(
    sampled.map((item) => item.frame),
    sortBy
  );
  const itemByFrame = new Map(sampled.map((item) => [item.frame, item]));

  return [...sortedFrames.map((frame) => itemByFrame.get(frame)!).filter(Boolean), ...missing];
}

/**
 * Repeats panels from either range-query frames (the binary-query fallback) or an authoritative
 * label-values variable. In the latter mode, range frames are secondary data used for ranking and
 * static histogram rendering; values missing from those sampled frames are still repeated.
 */
interface SceneByFrameRepeaterState extends SceneObjectState {
  $behaviors: Array<SceneObject | SceneStatelessBehavior>;
  body: SceneLayout;
  variableName?: string;
  getLayoutChild(
    data: PanelData,
    frame: DataFrame | undefined,
    frameIndex: number,
    labelValue: string
  ): SceneObject | null;
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
const EMPTY_PANEL_DATA = { state: LoadingState.Done, series: [] } as unknown as PanelData;

export class SceneByFrameRepeater extends SceneObjectBase<SceneByFrameRepeaterState> {
  private searchText = '';
  private sortBy?: SortSeriesByOption;
  private variable?: MultiValueVariable;

  public constructor({
    $behaviors,
    body,
    variableName,
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
    variableName?: string;
    getLayoutChild: SceneByFrameRepeaterState['getLayoutChild'];
    getLayoutLoading?: NonNullable<SceneByFrameRepeaterState['getLayoutLoading']>;
    getLayoutError?: NonNullable<SceneByFrameRepeaterState['getLayoutError']>;
    getLayoutEmpty?: NonNullable<SceneByFrameRepeaterState['getLayoutEmpty']>;
    initialPageSize?: SceneByFrameRepeaterState['initialPageSize'];
    pageSizeIncrement?: SceneByFrameRepeaterState['pageSizeIncrement'];
    $data?: NonNullable<SceneByFrameRepeaterState['$data']>;
  }) {
    super({
      key: 'breakdown-by-frame-repeater',
      $behaviors,
      body,
      variableName,
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
      this.initVariable();

      this._subs.add(
        dataProvider.subscribeToState((newState) => {
          this.performRepeat(newState.data);
        })
      );

      this.performRepeat(dataProvider.state.data);
    });
  }

  private initVariable() {
    if (!this.state.variableName) {
      return;
    }

    const variable = sceneGraph.lookupVariable(this.state.variableName, this);
    if (!(variable instanceof MultiValueVariable)) {
      throw new Error('SceneByFrameRepeater: variable is not a MultiValueVariable!');
    }

    this.variable = variable;
    this._subs.add(
      variable.subscribeToState((newState, prevState) => {
        if (
          newState.loading !== prevState.loading ||
          newState.error !== prevState.error ||
          newState.options !== prevState.options
        ) {
          this.performRepeat(sceneGraph.getData(this).state.data);
        }
      })
    );
  }

  private performRepeat(data?: PanelData) {
    if (this.variable?.state.error) {
      this.setState({
        errorLayout: this.state.getLayoutError?.({
          ...EMPTY_PANEL_DATA,
          state: LoadingState.Error,
          errors: [this.variable.state.error],
        }),
        loadingLayout: undefined,
        emptyLayout: undefined,
        currentBatchSize: 0,
      });
      return;
    }

    if (this.variable?.state.loading || !data || data.state === LoadingState.Loading) {
      this.setState({
        loadingLayout: this.state.getLayoutLoading?.(),
        errorLayout: undefined,
        emptyLayout: undefined,
        currentBatchSize: 0,
      });
      return;
    }

    if (!this.variable && data?.state === LoadingState.Error) {
      this.setState({
        errorLayout: this.state.getLayoutError?.(data),
        loadingLayout: undefined,
        emptyLayout: undefined,
        currentBatchSize: 0,
      });
      return;
    }

    const panelData = data ?? EMPTY_PANEL_DATA;
    const items = this.getFilteredAndSortedItems(panelData);
    const totalItems = this.getItems(panelData).length;

    if (!items.length) {
      this.state.body.setState({ children: [] });
      this.setState({
        emptyLayout: this.state.getLayoutEmpty?.(),
        errorLayout: undefined,
        loadingLayout: undefined,
        currentBatchSize: 0,
        counts: { current: 0, total: totalItems },
      });
      return;
    }

    const currentBatchSize = Math.min(this.state.initialPageSize, items.length);
    this.setState({
      loadingLayout: undefined,
      errorLayout: undefined,
      emptyLayout: undefined,
      currentBatchSize,
      counts: { current: items.length, total: totalItems },
    });

    const newChildren = this.buildChildren(panelData, items.slice(0, currentBatchSize), 0);
    this.state.body.setState({ children: newChildren });
  }

  private initFilterAndSort() {
    this.searchText = sceneGraph.findByKeyAndType(this, 'quick-search', QuickSearch).state.value;
    this.sortBy = sceneGraph.findByKeyAndType(this, 'breakdown-sort-by', SortBySelector).state.value.value;
  }

  private getItems(data: PanelData): LabelValueItem[] {
    const values = this.variable
      ? getMultiVariableValues(this.variable).map((option) => String(option.value ?? ''))
      : undefined;
    const series = data.state === LoadingState.Done ? data.series : [];
    return buildLabelValueItems(values, series);
  }

  private getFilteredAndSortedItems(data: PanelData): LabelValueItem[] {
    return filterAndSortLabelValueItems(this.getItems(data), this.searchText, this.sortBy);
  }

  private buildChildren(data: PanelData, items: LabelValueItem[], offset: number): SceneObject[] {
    return items
      .map((item, index) => this.state.getLayoutChild(data, item.frame, offset + index, item.value))
      .filter(Boolean) as SceneObject[];
  }

  public filter(searchText: string) {
    this.searchText = searchText;
    this.publishEvent(new EventResetSyncYAxis({}), true);
    this.performRepeat(sceneGraph.getData(this).state.data);
  }

  public sort(sortBy: SortSeriesByOption) {
    this.sortBy = sortBy;
    this.publishEvent(new EventResetSyncYAxis({}), true);
    this.performRepeat(sceneGraph.getData(this).state.data);
  }

  public increaseBatchSize() {
    const data = sceneGraph.getData(this).state.data ?? EMPTY_PANEL_DATA;
    const items = this.getFilteredAndSortedItems(data);
    const newBatchSize = Math.min(this.state.currentBatchSize + this.state.pageSizeIncrement, items.length);
    const newChildren = this.buildChildren(
      data,
      items.slice(this.state.currentBatchSize, newBatchSize),
      this.state.currentBatchSize
    );

    this.state.body.setState({
      children: [...this.state.body.state.children, ...newChildren],
    });
    this.setState({ currentBatchSize: newBatchSize });
    this.publishEvent(new EventForceSyncYAxis({}), true);
  }

  public useSizes() {
    const { currentBatchSize, pageSizeIncrement } = this.useState();
    const data = sceneGraph.getData(this).state.data ?? EMPTY_PANEL_DATA;
    const total = this.getFilteredAndSortedItems(data).length;
    const remaining = total - currentBatchSize;
    const increment = remaining < pageSizeIncrement ? remaining : pageSizeIncrement;

    return { increment, current: currentBatchSize, total };
  }

  public getCounts() {
    const data = sceneGraph.getData(this).state.data ?? EMPTY_PANEL_DATA;
    return {
      current: this.getFilteredAndSortedItems(data).length,
      total: this.getItems(data).length,
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
