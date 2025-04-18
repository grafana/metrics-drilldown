import { css } from '@emotion/css';
import { BusEventBase, type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Combobox, Field, IconButton, useStyles2 } from '@grafana/ui';
import React from 'react';

import { getSortByPreference, setSortByPreference } from '../services/store';

export interface SortBySceneState extends SceneObjectState {
  target: 'fields' | 'labels';
  sortBy: string;
}

export class SortCriteriaChanged extends BusEventBase {
  constructor(public target: 'fields' | 'labels', public sortBy: string) {
    super();
  }

  public static type = 'sort-criteria-changed';
}

export class SortByScene extends SceneObjectBase<SortBySceneState> {
  public sortingOptions = [
    {
      value: 'outliers',
      label: 'Outlying series',
      description: 'Prioritizes values that show distinct behavior from others within the same label',
    },
    {
      value: 'alphabetical',
      label: 'Name [A-Z]',
      description: 'Alphabetical order',
    },
    {
      value: 'alphabetical-reversed',
      label: 'Name [Z-A]',
      description: 'Reversed alphabetical order',
    },
  ];

  constructor(state: Pick<SortBySceneState, 'target'>) {
    const { sortBy } = getSortByPreference(state.target, 'outliers');
    super({
      target: state.target,
      sortBy,
    });
  }

  public onCriteriaChange = (criteria: SelectableValue<string> | null) => {
    if (!criteria?.value) {
      return;
    }
    this.setState({ sortBy: criteria.value });
    setSortByPreference(this.state.target, criteria.value);
    this.publishEvent(new SortCriteriaChanged(this.state.target, criteria.value), true);
  };

  public static Component = ({ model }: SceneComponentProps<SortByScene>) => {
    const styles = useStyles2(getStyles);
    const { sortBy } = model.useState();
    const value = model.sortingOptions.find((option) => option.value === sortBy);
    return (
      <Field
        htmlFor="sort-by-criteria"
        label={
          <div className={styles.sortByTooltip}>
            Sort by
            <IconButton
              name={'info-circle'}
              size="sm"
              variant={'secondary'}
              tooltip="Sorts values using standard or smart time series calculations."
            />
          </div>
        }
      >
        <Combobox
          id="sort-by-criteria"
          value={value}
          width={20}
          options={model.sortingOptions}
          placeholder={'Choose criteria'}
          onChange={model.onCriteriaChange}
          isClearable={false}
        />
      </Field>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    sortByTooltip: css({
      display: 'flex',
      gap: theme.spacing(1),
    }),
  };
}
