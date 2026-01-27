import { css } from '@emotion/css';
import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, SceneObjectBase, type SceneComponentProps } from '@grafana/scenes';
import { Icon, IconButton, Input, Spinner, useStyles2 } from '@grafana/ui';
import React, { useMemo, useState } from 'react';

import { NULL_GROUP_BY_VALUE } from 'MetricsReducer/labels/LabelsDataSource';
import { type LabelsVariable } from 'MetricsReducer/labels/LabelsVariable';

import { reportExploreMetrics } from '../../../../shared/tracking/interactions';
import { SectionTitle } from '../SectionTitle';
import { type SideBarSectionState } from '../types';
import { LabelsList } from './LabelsList';

interface LabelsBrowserState extends SideBarSectionState {
  variableName: string;
}

export class LabelsBrowser extends SceneObjectBase<LabelsBrowserState> {
  constructor({
    key,
    variableName,
    title,
    description,
    icon,
    disabled,
    active,
  }: {
    key: LabelsBrowserState['key'];
    variableName: LabelsBrowserState['variableName'];
    title: LabelsBrowserState['title'];
    description: LabelsBrowserState['description'];
    icon: LabelsBrowserState['icon'];
    disabled?: LabelsBrowserState['disabled'];
    active?: LabelsBrowserState['active'];
  }) {
    super({
      key,
      variableName,
      title,
      description,
      icon,
      disabled: disabled ?? false,
      active: active ?? false,
    });
  }

  private selectLabel(label: string) {
    const labelsVariable = sceneGraph.lookupVariable(this.state.variableName, this) as LabelsVariable;
    labelsVariable.changeValueTo(label);

    const active = Boolean(label && label !== NULL_GROUP_BY_VALUE);

    this.setState({ active });
  }

  private onSelectLabel = (label: string) => {
    reportExploreMetrics('sidebar_group_by_label_filter_applied', { label });
    this.selectLabel(label);
  };

  private onClearSelection = () => {
    this.selectLabel(NULL_GROUP_BY_VALUE);
  };

  private useLabelsBrowser = () => {
    const { variableName, title, description } = this.useState();

    const labelsVariable = sceneGraph.lookupVariable(variableName, this) as LabelsVariable;
    const { loading, options: labels, value: labelValue } = labelsVariable.useState();

    const [searchValue, setSearchValue] = useState('');

    const labelsList: Array<SelectableValue<string>> = useMemo(() => {
      const filters = [
        (item: string) => item !== NULL_GROUP_BY_VALUE,
        (item: string) => item.toLowerCase().includes(searchValue.toLowerCase()),
      ];

      return labels.filter((item) => filters.every((filter) => filter(item.value as string))) as Array<
        SelectableValue<string>
      >;
    }, [labels, searchValue]);

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchValue(e.currentTarget.value);
    };

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSearchValue('');
      }
    };

    const onInputClear = () => {
      setSearchValue('');
    };

    return {
      title,
      description,
      loading,
      selectedLabel: labelValue as string,
      labelsList,
      searchValue,
      onInputChange,
      onInputKeyDown,
      onInputClear,
    };
  };

  public static readonly Component = ({ model }: SceneComponentProps<LabelsBrowser>) => {
    const styles = useStyles2(getStyles);

    const {
      title,
      description,
      loading,
      labelsList,
      selectedLabel,
      searchValue,
      onInputChange,
      onInputKeyDown,
      onInputClear,
    } = model.useLabelsBrowser();

    return (
      <div className={styles.container} data-testid="labels-browser">
        <SectionTitle title={title} description={description} />

        <Input
          className={styles.search}
          prefix={<Icon name="search" />}
          placeholder={t('sidebar.labels-browser.search-placeholder', 'Search...')}
          value={searchValue}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
          suffix={
            <IconButton
              name="times"
              variant="secondary"
              tooltip={t('sidebar.labels-browser.clear-search-tooltip', 'Clear search')}
              onClick={onInputClear}
            />
          }
        />

        {loading && <Spinner inline />}

        {!loading && (
          <LabelsList
            labels={labelsList}
            selectedLabel={selectedLabel}
            onSelectLabel={model.onSelectLabel}
            onClearSelection={model.onClearSelection}
          />
        )}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
      overflowY: 'hidden',
    }),
    search: css({
      marginBottom: theme.spacing(1),
      padding: theme.spacing(0, 0.5),
    }),
  };
}
