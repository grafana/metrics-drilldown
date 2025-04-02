import {
  MultiValueVariable,
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type SceneComponentProps,
  type SceneLayout,
  type SceneObject,
  type SceneObjectState,
  type VariableValueOption,
} from '@grafana/scenes';
import React from 'react';

/**
 * This component has been borrowd from Scenes v5,41,1, which is the version Metrics Drilldown currently use.
 *
 * The main purpose of this new component is to create a Scene object that has the capabilities of the original SceneByVariableRepeater and
 * that also to provide:
 *
 *   1. lazy loading/pagination
 *   2. configurable loading/error/empty states
 *   4. minor details (like calling getLayoutChild() and passing an index for multi coloring timeseries)
 *
 *
 */
interface SceneByVariableRepeaterState extends SceneObjectState {
  variableName: string;
  body: SceneLayout;
  getLayoutChild(option: VariableValueOption, index: number, options: VariableValueOption[]): SceneObject | null;
  getLayoutLoading?: () => SceneObject;
  getLayoutError?: (error: Error) => SceneObject;
  getLayoutEmpty?: () => SceneObject;
  currentBatchSize: number;
  initialPageSize: number;
  pageSizeIncrement: number;
  loadingLayout?: SceneObject;
  errorLayout?: SceneObject;
  emptyLayout?: SceneObject;
}

const DEFAULT_INITIAL_PAGE_SIZE = 6;
const DEFAULT_PAGE_SIZE_INCREMENT = 9;

export class SceneByVariableRepeater extends SceneObjectBase<SceneByVariableRepeaterState> {
  protected _variableDependency: VariableDependencyConfig<SceneByVariableRepeaterState> = new VariableDependencyConfig(
    this,
    {
      variableNames: [this.state.variableName],
      onVariableUpdateCompleted: () => this.performRepeat(),
    }
  );

  public constructor({
    variableName,
    body,
    getLayoutChild,
    getLayoutLoading,
    getLayoutError,
    getLayoutEmpty,
    initialPageSize,
    pageSizeIncrement,
  }: {
    variableName: SceneByVariableRepeaterState['variableName'];
    body: SceneByVariableRepeaterState['body'];
    getLayoutChild: SceneByVariableRepeaterState['getLayoutChild'];
    getLayoutLoading?: SceneByVariableRepeaterState['getLayoutLoading'];
    getLayoutError?: SceneByVariableRepeaterState['getLayoutError'];
    getLayoutEmpty?: SceneByVariableRepeaterState['getLayoutEmpty'];
    initialPageSize?: SceneByVariableRepeaterState['initialPageSize'];
    pageSizeIncrement?: SceneByVariableRepeaterState['pageSizeIncrement'];
  }) {
    super({
      variableName,
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

    this.addActivationHandler(() => this.performRepeat());
  }

  private performRepeat() {
    if (this._variableDependency.hasDependencyInLoadingState()) {
      this.setState({
        loadingLayout: this.state.getLayoutLoading?.(),
        errorLayout: undefined,
        emptyLayout: undefined,
        currentBatchSize: 0,
      });
      return;
    }

    const variable = sceneGraph.lookupVariable(this.state.variableName, this);
    if (!(variable instanceof MultiValueVariable)) {
      console.error('SceneByVariableRepeater: variable is not a MultiValueVariable!', variable);
      return;
    }

    if (variable.state.error) {
      this.setState({
        errorLayout: this.state.getLayoutError?.(variable.state.error),
        loadingLayout: undefined,
        emptyLayout: undefined,
        currentBatchSize: 0,
      });
      return;
    }

    const values = getMultiVariableValues(variable);

    if (!values.length) {
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

    const newChildren: SceneObject[] = values
      .slice(0, this.state.initialPageSize)
      .map((option, index) => this.state.getLayoutChild(option, index, values))
      .filter(Boolean) as SceneObject[];

    this.state.body.setState({
      children: newChildren,
    });
  }

  public increaseBatchSize() {
    const variable = sceneGraph.lookupVariable(this.state.variableName, this) as MultiValueVariable;
    const values = getMultiVariableValues(variable);

    const newBatchSize = this.state.currentBatchSize + this.state.pageSizeIncrement;

    const newChildren: SceneObject[] = values
      .slice(this.state.currentBatchSize, newBatchSize)
      .map((option, index) => this.state.getLayoutChild(option, this.state.currentBatchSize + index, values))
      .filter(Boolean) as SceneObject[];

    this.state.body.setState({
      children: [...this.state.body.state.children, ...newChildren],
    });

    this.setState({
      currentBatchSize: newBatchSize,
    });
  }

  public useSizes() {
    const { currentBatchSize, pageSizeIncrement } = this.useState();
    const variable = sceneGraph.lookupVariable(this.state.variableName, this);
    return {
      increment: pageSizeIncrement,
      current: currentBatchSize,
      total: (variable as MultiValueVariable).state.options.length,
    };
  }

  public static Component = ({ model }: SceneComponentProps<SceneByVariableRepeater>) => {
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

export function getMultiVariableValues(variable: MultiValueVariable): VariableValueOption[] {
  const { value, text, options } = variable.state;

  if (variable.hasAllValue()) {
    return options;
  }

  if (Array.isArray(value) && Array.isArray(text)) {
    return value.map((v, i) => ({ value: v, label: text[i] as string }));
  }

  return [{ value: value as string, label: text as string }];
}
