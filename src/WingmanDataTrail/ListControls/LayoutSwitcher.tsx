import {
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  type SceneComponentProps,
  type SceneObjectState,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { RadioButtonGroup } from '@grafana/ui';
import React from 'react';

import { reportExploreMetrics } from 'interactions';

export enum LayoutType {
  GRID = 'grid',
  ROWS = 'rows',
  SINGLE = 'single',
}

export interface LayoutSwitcherState extends SceneObjectState {
  urlSearchParamName: string;
  layout: LayoutType;
  options: Array<{ label: string; value: LayoutType }>;
}

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: [this.state.urlSearchParamName],
  });

  static readonly DEFAULT_OPTIONS = [
    { label: 'Grid', value: LayoutType.GRID },
    { label: 'Rows', value: LayoutType.ROWS },
  ];

  static readonly DEFAULT_LAYOUT = LayoutType.GRID;

  constructor({
    urlSearchParamName,
    options,
  }: {
    urlSearchParamName?: LayoutSwitcherState['urlSearchParamName'];
    options?: LayoutSwitcherState['options'];
  }) {
    super({
      key: 'layout-switcher',
      urlSearchParamName: urlSearchParamName || 'layout',
      options: options || LayoutSwitcher.DEFAULT_OPTIONS,
      layout: LayoutSwitcher.DEFAULT_LAYOUT,
    });
  }

  getUrlState() {
    return {
      [this.state.urlSearchParamName]: this.state.layout,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<LayoutSwitcherState> = {};
    const newLayout = values[this.state.urlSearchParamName] as LayoutType;

    if (newLayout !== this.state.layout) {
      stateUpdate.layout = this.state.options.find((o) => o.value === newLayout)
        ? newLayout
        : LayoutSwitcher.DEFAULT_LAYOUT;
    }

    this.setState(stateUpdate);
  }

  private onChange = (layout: LayoutType) => {
    reportExploreMetrics('layout_changed', { layout });
    this.setState({ layout });
  };

  static readonly Component = ({ model }: SceneComponentProps<LayoutSwitcher>) => {
    const { options, layout } = model.useState();

    return (
      <RadioButtonGroup
        aria-label="Layout switcher"
        options={options}
        value={layout}
        onChange={model.onChange}
        fullWidth={false}
      />
    );
  };
}
