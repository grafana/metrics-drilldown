import { type SelectableValue } from '@grafana/data';
import {
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type SceneObjectUrlValues,
  type SceneObjectWithUrlSync,
} from '@grafana/scenes';
import { RadioButtonGroup } from '@grafana/ui';
import React from 'react';

import { reportExploreMetrics } from '../interactions';
import { getVewByPreference, setVewByPreference } from '../services/store';
import { type MakeOptional } from '../shared';
import { isBreakdownLayoutType, type BreakdownLayoutChangeCallback, type BreakdownLayoutType } from './types';

export interface LayoutSwitcherState extends SceneObjectState {
  activeBreakdownLayout: BreakdownLayoutType;
  breakdownLayouts: SceneObject[];
  breakdownLayoutOptions: Array<SelectableValue<BreakdownLayoutType>>;
  onBreakdownLayoutChange: BreakdownLayoutChangeCallback;
}

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> implements SceneObjectWithUrlSync {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['breakdownLayout'] });

  public constructor(state: MakeOptional<LayoutSwitcherState, 'activeBreakdownLayout'>) {
    const storedBreakdownLayout = getVewByPreference();
    super({
      activeBreakdownLayout: isBreakdownLayoutType(storedBreakdownLayout) ? storedBreakdownLayout : 'grid',
      ...state,
    });
  }

  getUrlState() {
    return { breakdownLayout: this.state.activeBreakdownLayout };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const newBreakdownLayout = values.breakdownLayout;
    if (typeof newBreakdownLayout === 'string' && isBreakdownLayoutType(newBreakdownLayout)) {
      if (this.state.activeBreakdownLayout !== newBreakdownLayout) {
        this.setState({ activeBreakdownLayout: newBreakdownLayout });
      }
    }
  }

  public Selector({ model }: { model: LayoutSwitcher }) {
    const { activeBreakdownLayout, breakdownLayoutOptions } = model.useState();

    return (
      <RadioButtonGroup
        aria-label="Layout switcher"
        options={breakdownLayoutOptions}
        value={activeBreakdownLayout}
        onChange={model.onLayoutChange}
      />
    );
  }

  public onLayoutChange = (active: BreakdownLayoutType) => {
    if (this.state.activeBreakdownLayout === active) {
      return;
    }

    reportExploreMetrics('breakdown_layout_changed', { layout: active });
    setVewByPreference(active);
    this.setState({ activeBreakdownLayout: active });
    this.state.onBreakdownLayoutChange(active);
  };

  public static readonly Component = ({ model }: SceneComponentProps<LayoutSwitcher>) => {
    const { breakdownLayouts, breakdownLayoutOptions, activeBreakdownLayout } = model.useState();

    const index = breakdownLayoutOptions.findIndex((o) => o.value === activeBreakdownLayout);
    if (index === -1) {
      return null;
    }

    const layout = breakdownLayouts[index];

    return <layout.Component model={layout} />;
  };
}
