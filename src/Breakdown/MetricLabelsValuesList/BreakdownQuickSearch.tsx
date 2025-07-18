import { css } from '@emotion/css';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Field, Icon, Input } from '@grafana/ui';
import React, { type ChangeEvent, type KeyboardEvent } from 'react';

export interface BreakdownQuickSearchState extends SceneObjectState {
  value: string;
}

export class BreakdownQuickSearch extends SceneObjectBase<BreakdownQuickSearchState> {
  constructor() {
    super({ key: 'breakdown-quick-search', value: '' });
  }

  private onChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ value: event.target.value });
  };

  private clear = () => {
    this.setState({ value: '' });
  };

  private onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.clear();
    }
  };

  public static readonly Component = ({ model }: SceneComponentProps<BreakdownQuickSearch>) => {
    const { value: value } = model.useState();

    return (
      <Field label="" className={styles.field}>
        <Input
          value={value}
          onChange={model.onChange}
          onKeyDown={model.onKeyDown}
          suffix={
            value ? (
              <Icon onClick={model.clear} title={'Clear search'} name="times" className={styles.clearIcon} />
            ) : undefined
          }
          prefix={<Icon name="search" />}
          placeholder="Quick search label values"
        />
      </Field>
    );
  };
}

const styles = {
  field: css({
    flexGrow: 1,
  }),
  clearIcon: css({
    cursor: 'pointer',
  }),
};
