import { css } from '@emotion/css';
import { BusEventBase } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Field, Icon, Input } from '@grafana/ui';
import React, { type ChangeEvent } from 'react';

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
    super({ filter: recentFilters[cacheKey] ?? '' });

    this.cacheKey = cacheKey;
  }

  public static readonly Component = ({ model }: SceneComponentProps<BreakdownSearchScene>) => {
    const { filter: value } = model.useState();
    return (
      <Field label="" className={styles.field}>
        <Input
          value={value}
          onChange={model.onValueFilterChange}
          suffix={
            value ? (
              <Icon onClick={model.clearValueFilter} title={'Clear search'} name="times" className={styles.clearIcon} />
            ) : undefined
          }
          prefix={<Icon name="search" />}
          placeholder="Quick search label values"
        />
      </Field>
    );
  };

  public onValueFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ filter: event.target.value });
    // this.filterValues(event.target.value);
  };

  public clearValueFilter = () => {
    this.setState({ filter: '' });
    // this.filterValues('');
  };

  public reset = () => {
    this.setState({ filter: '' });
    recentFilters[this.cacheKey] = '';
  };

  // private filterValues(filter: string) {
  //   if (this.parent instanceof LabelBreakdownScene) {
  //     recentFilters[this.cacheKey] = filter;
  //     const body = this.parent.state.body;
  //     body?.forEachChild((child) => {
  //       if (child instanceof ByFrameRepeater && child.state.body.isActive) {
  //         child.filterByString(filter);
  //       }
  //     });
  //   }
  // }
}

const styles = {
  field: css({
    flexGrow: 1,
  }),
  clearIcon: css({
    cursor: 'pointer',
  }),
};
