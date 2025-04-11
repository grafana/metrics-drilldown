import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type MultiValueVariable,
  type SceneComponentProps,
} from '@grafana/scenes';
import { Icon, IconButton, Input, Spinner, Switch, useStyles2 } from '@grafana/ui';
import React, { useMemo, useState, type KeyboardEventHandler } from 'react';

import { EventFiltersChanged } from 'WingmanDataTrail/HeaderControls/QuickSearch/EventFiltersChanged';
import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import {
  VAR_METRICS_VARIABLE,
  type MetricOptions,
  type MetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/MetricsVariable';
import { type MetricFilters } from 'WingmanDataTrail/MetricsVariables/MetricsVariableFilterEngine';

import { SectionTitle } from '../SectionTitle';
import { type SideBarSectionState } from '../types';
import { CheckBoxList } from './CheckBoxList';

export interface MetricsFilterSectionState extends SideBarSectionState {
  type: keyof MetricFilters;
  computeGroups: (
    options: Array<{ label: string; value: string }>
  ) => Array<{ label: string; value: string; count: number }>;
  showHideEmpty: boolean;
  showSearch: boolean;
  groups: Array<{ label: string; value: string; count: number }>;
  selectedGroups: string[];
  loading: boolean;
}

export class MetricsFilterSection extends SceneObjectBase<MetricsFilterSectionState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    onAnyVariableChanged: (variable) => {
      const { name, options } = (variable as MultiValueVariable).state;

      if (name === VAR_METRICS_VARIABLE) {
        this.updateLists(options as MetricOptions);
        return;
      }

      if (name === VAR_FILTERED_METRICS_VARIABLE) {
        this.updateCounts(options as MetricOptions);
        return;
      }
    },
  });

  constructor({
    key,
    type,
    title,
    description,
    iconName,
    computeGroups,
    showHideEmpty,
    showSearch,
    disabled,
  }: {
    key: MetricsFilterSectionState['key'];
    type: MetricsFilterSectionState['type'];
    title: MetricsFilterSectionState['title'];
    description: MetricsFilterSectionState['description'];
    iconName: MetricsFilterSectionState['iconName'];
    computeGroups: MetricsFilterSectionState['computeGroups'];
    showHideEmpty?: MetricsFilterSectionState['showHideEmpty'];
    showSearch?: MetricsFilterSectionState['showSearch'];
    disabled?: MetricsFilterSectionState['disabled'];
  }) {
    super({
      key,
      type,
      title,
      description,
      iconName,
      groups: [],
      computeGroups,
      selectedGroups: [],
      loading: true,
      showHideEmpty: showHideEmpty ?? true,
      showSearch: showSearch ?? true,
      disabled: disabled ?? false,
      active: false,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const metricsVariable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MetricsVariable;
    const filteredMetricsVariable = sceneGraph.lookupVariable(
      VAR_FILTERED_METRICS_VARIABLE,
      this
    ) as FilteredMetricsVariable;

    this.updateLists(metricsVariable.state.options as MetricOptions);
    this.updateCounts(filteredMetricsVariable.state.options as MetricOptions);

    this.setState({
      loading: filteredMetricsVariable.state.loading,
      active: this.state.selectedGroups.length > 0,
    });
  }

  private updateLists(options: MetricOptions) {
    this.setState({
      groups: this.state.computeGroups(options),
      loading: false,
    });
  }

  private updateCounts(filteredOptions: MetricOptions) {
    const { groups, computeGroups } = this.state;
    const newGroups = computeGroups(filteredOptions);

    this.setState({
      groups: groups.map((group) => ({
        ...group,
        count: newGroups.find((p) => p.label === group.label)?.count || 0,
      })),
      loading: false,
    });
  }

  onSelectionChange = (selectedGroups: string[]) => {
    this.setState({ selectedGroups, active: selectedGroups.length > 0 });

    this.publishEvent(new EventFiltersChanged({ type: this.state.type, filters: selectedGroups }), true);
  };

  public static Component = ({ model }: SceneComponentProps<MetricsFilterSection>) => {
    const styles = useStyles2(getStyles);
    const { groups, selectedGroups, loading, title, description, showHideEmpty, showSearch } = model.useState();

    const [hideEmpty, setHideEmpty] = useState(false);
    const [searchValue, setSearchValue] = useState('');

    const filteredGroups = useMemo(() => {
      const filters: Array<(item: { label: string; value: string; count: number }) => boolean> = [];

      if (hideEmpty) {
        filters.push((item) => item.count > 0);
      }

      filters.push((item) => item.label.toLowerCase().includes(searchValue.toLowerCase()));

      return groups.filter((group) => filters.every((filter) => filter(group)));
    }, [hideEmpty, groups, searchValue]);

    const onKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSearchValue('');
      }
    };

    return (
      <div className={styles.container}>
        <SectionTitle title={title} description={description} />

        {showHideEmpty && (
          <div className={styles.switchContainer}>
            <span className={styles.switchLabel}>Hide empty</span>
            <Switch value={hideEmpty} onChange={(e) => setHideEmpty(e.currentTarget.checked)} />
          </div>
        )}

        {showSearch && (
          <Input
            className={styles.searchInput}
            prefix={<Icon name="search" />}
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.currentTarget.value)}
            onKeyDown={onKeyDown}
            suffix={
              <IconButton name="times" variant="secondary" tooltip="Clear search" onClick={(e) => setSearchValue('')} />
            }
          />
        )}

        {loading && <Spinner inline />}

        {!loading && (
          <CheckBoxList
            groups={filteredGroups}
            selectedGroups={selectedGroups}
            onSelectionChange={model.onSelectionChange}
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
    switchContainer: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: theme.spacing(1),
    }),
    switchLabel: css({
      fontSize: '12px',
      color: theme.colors.text.primary,
    }),
    searchInput: css({
      flexBasis: '32px',
      flexShrink: 0,
      marginBottom: theme.spacing(1),
      padding: theme.spacing(0, 0.5),
    }),
  };
}
