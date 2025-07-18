import {
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  type SceneComponentProps,
  type SceneObjectState,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { RadioButtonGroup } from '@grafana/ui';
import React from 'react';

export enum LayoutType {
  GRID = 'grid',
  ROWS = 'rows',
  SINGLE = 'single',
}

export interface LayoutSwitcherState extends SceneObjectState {
  layout: LayoutType;
  options: Array<{ label: string; value: LayoutType }>;
}

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['layout'] });

  static readonly DEFAULT_OPTIONS = [
    { label: 'Grid', value: LayoutType.GRID },
    { label: 'Rows', value: LayoutType.ROWS },
  ];

  static readonly DEFAULT_LAYOUT = LayoutType.GRID;

  constructor({ options }: { options?: LayoutSwitcherState['options'] }) {
    super({
      key: 'layout-switcher',
      options: options || LayoutSwitcher.DEFAULT_OPTIONS,
      layout: LayoutSwitcher.DEFAULT_LAYOUT,
    });
  }

  getUrlState() {
    return {
      layout: this.state.layout,
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<LayoutSwitcherState> = {};

    if (typeof values.layout === 'string' && values.layout !== this.state.layout) {
      stateUpdate.layout = this.state.options.find((o) => o.value === values.layout)
        ? (values.layout as LayoutType)
        : LayoutSwitcher.DEFAULT_LAYOUT;
    }

    this.setState(stateUpdate);
  }

  onChange = (layout: LayoutType) => {
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
