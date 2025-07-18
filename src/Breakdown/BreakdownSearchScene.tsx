import { BusEventBase } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import React, { type ChangeEvent } from 'react';

import { ByFrameRepeater } from './ByFrameRepeater';
import { LabelBreakdownScene } from './LabelBreakdownScene';
import { SearchInput } from './SearchInput';

export class BreakdownSearchReset extends BusEventBase {
  public static readonly type = 'breakdown-search-reset';
}

export interface BreakdownSearchSceneState extends SceneObjectState {
  filter?: string;
}

const recentFilters: Record<string, string> = {};

export class BreakdownSearchScene extends SceneObjectBase<BreakdownSearchSceneState> {
  private cacheKey: string;

  constructor(cacheKey: string) {
    super({
      filter: recentFilters[cacheKey] ?? '',
    });
    this.cacheKey = cacheKey;
  }

  public static readonly Component = ({ model }: SceneComponentProps<BreakdownSearchScene>) => {
    const { filter } = model.useState();
    return (
      <SearchInput
        value={filter}
        onChange={model.onValueFilterChange}
        onClear={model.clearValueFilter}
        placeholder="Quick search label values"
      />
    );
  };

  public onValueFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ filter: event.target.value });
    this.filterValues(event.target.value);
  };

  public clearValueFilter = () => {
    this.setState({ filter: '' });
    this.filterValues('');
  };

  public reset = () => {
    this.setState({ filter: '' });
    recentFilters[this.cacheKey] = '';
  };

  private filterValues(filter: string) {
    if (this.parent instanceof LabelBreakdownScene) {
      recentFilters[this.cacheKey] = filter;
      const body = this.parent.state.body;
      body?.forEachChild((child) => {
        if (child instanceof ByFrameRepeater && child.state.body.isActive) {
          child.filterByString(filter);
        }
      });
    }
  }
}
