import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Combobox, Field, IconButton, useStyles2, type ComboboxOption } from '@grafana/ui';
import React from 'react';

import { type SortSeriesByOption } from 'services/sorting';

import { PREF_KEYS } from '../../UserPreferences/pref-keys';
import { userStorage } from '../../UserPreferences/userStorage';

export interface SortBySelectorState extends SceneObjectState {
  target: 'fields' | 'labels';
  options: Array<ComboboxOption<SortSeriesByOption>>;
  value: ComboboxOption<SortSeriesByOption>;
}

export class SortBySelector extends SceneObjectBase<SortBySelectorState> {
  static readonly DEFAULT_OPTIONS = [
    {
      value: 'outliers' as SortSeriesByOption,
      label: 'Outlying series',
      description: 'Prioritizes values that show distinct behavior from others within the same label',
    },
    {
      value: 'alphabetical' as SortSeriesByOption,
      label: 'Name [A-Z]',
      description: 'Alphabetical order',
    },
    {
      value: 'alphabetical-reversed' as SortSeriesByOption,
      label: 'Name [Z-A]',
      description: 'Reversed alphabetical order',
    },
  ];

  constructor(state: Pick<SortBySelectorState, 'target'>) {
    const sortBy = userStorage.getItem(PREF_KEYS.BREAKDOWN_SORTBY);

    super({
      key: 'breakdown-sort-by',
      target: state.target,
      options: SortBySelector.DEFAULT_OPTIONS,
      value:
        (sortBy && SortBySelector.DEFAULT_OPTIONS.find((o) => o.value === sortBy)) || SortBySelector.DEFAULT_OPTIONS[0],
    });
  }

  private onChange = (option: ComboboxOption<SortSeriesByOption>) => {
    this.setState({ value: option });
    userStorage.setItem(PREF_KEYS.BREAKDOWN_SORTBY, option.value);
  };

  public static readonly Component = ({ model }: SceneComponentProps<SortBySelector>) => {
    const styles = useStyles2(getStyles);
    const { value, options } = model.useState();

    return (
      <Field
        data-testid="sort-by-select"
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
          placeholder="Choose criteria"
          width={20}
          options={options}
          value={value}
          onChange={model.onChange}
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
