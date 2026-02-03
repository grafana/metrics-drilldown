import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Combobox, Field, IconButton, useStyles2, type ComboboxOption } from '@grafana/ui';
import React from 'react';

import { type SortSeriesByOption } from 'shared/services/sorting';
import { PREF_KEYS } from 'shared/user-preferences/pref-keys';
import { userStorage } from 'shared/user-preferences/userStorage';

export interface SortBySelectorState extends SceneObjectState {
  target: 'fields' | 'labels';
  options: Array<ComboboxOption<SortSeriesByOption>>;
  value: ComboboxOption<SortSeriesByOption>;
}

function getDefaultOptions(): Array<ComboboxOption<SortSeriesByOption>> {
  return [
    {
      value: 'outliers' as SortSeriesByOption,
      label: t('sort-by.option.outliers', 'Outlying series'),
      description: t(
        'sort-by.option.outliers-description',
        'Prioritizes values that show distinct behavior from others within the same label'
      ),
    },
    {
      value: 'alphabetical' as SortSeriesByOption,
      label: t('sort-by.option.alphabetical', 'Name [A-Z]'),
      description: t('sort-by.option.alphabetical-description', 'Alphabetical order'),
    },
    {
      value: 'alphabetical-reversed' as SortSeriesByOption,
      label: t('sort-by.option.alphabetical-reversed', 'Name [Z-A]'),
      description: t('sort-by.option.alphabetical-reversed-description', 'Reversed alphabetical order'),
    },
  ];
}

export class SortBySelector extends SceneObjectBase<SortBySelectorState> {
  static readonly DEFAULT_OPTIONS = getDefaultOptions();

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
    const { value } = model.useState();
    const translatedOptions = getDefaultOptions();

    return (
      <Field
        className={styles.field}
        data-testid="sort-by-select"
        htmlFor="sort-by-criteria"
        label={
          <div className={styles.sortByTooltip}>
            {t('sort-by.label', 'Sort by')}
            <IconButton
              name={'info-circle'}
              size="sm"
              variant={'secondary'}
              tooltip={t('sort-by.tooltip', 'Sorts values using standard or smart time series calculations.')}
              aria-label={t('sort-by.tooltip', 'Sorts values using standard or smart time series calculations.')}
            />
          </div>
        }
      >
        <Combobox
          id="sort-by-criteria"
          placeholder={t('sort-by.placeholder', 'Choose criteria')}
          width={20}
          options={translatedOptions}
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
    field: css({
      marginBottom: 0,
    }),
  };
}
