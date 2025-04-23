import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  VariableDependencyConfig,
  type MultiValueVariable,
  type SceneComponentProps,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { Icon, IconButton, Input, Spinner, Switch, useStyles2 } from '@grafana/ui';
import React, { useMemo, useState, type KeyboardEventHandler } from 'react';

import { EventFiltersChanged } from 'WingmanDataTrail/ListControls/QuickSearch/EventFiltersChanged';
import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { ruleGroupLabels, type RuleGroupLabel } from 'WingmanDataTrail/MetricsVariables/metricLabels';
import {
  VAR_METRICS_VARIABLE,
  type MetricOptions,
  type MetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/MetricsVariable';
import { type MetricFilters } from 'WingmanDataTrail/MetricsVariables/MetricsVariableFilterEngine';

import { reportExploreMetrics } from '../../../../interactions';
import { EventSectionValueChanged } from '../EventSectionValueChanged';
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
  selectedGroups: Array<{ label: RuleGroupLabel; value: string }>; // we need labels for displaying tooltips in `SideBar.tsx`
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

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: [this.state.key] });

  getUrlState() {
    return {
      [this.state.key]: this.state.selectedGroups.map((g) => g.value).join(','),
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<MetricsFilterSectionState> = {};

    if (
      typeof values[this.state.key] === 'string' &&
      values[this.state.key] !== this.state.selectedGroups.map((g) => g.value).join(',')
    ) {
      stateUpdate.selectedGroups = (values[this.state.key] as string)
        .split(',')
        .map((v) => ({ label: v as RuleGroupLabel, value: v })) as Array<{ label: RuleGroupLabel; value: string }>;
    }

    this.setState(stateUpdate);
  }

  constructor({
    key,
    type,
    title,
    description,
    icon,
    computeGroups,
    showHideEmpty,
    showSearch,
    disabled,
    active,
  }: {
    key: MetricsFilterSectionState['key'];
    type: MetricsFilterSectionState['type'];
    title: MetricsFilterSectionState['title'];
    description: MetricsFilterSectionState['description'];
    icon: MetricsFilterSectionState['icon'];
    computeGroups: MetricsFilterSectionState['computeGroups'];
    showHideEmpty?: MetricsFilterSectionState['showHideEmpty'];
    showSearch?: MetricsFilterSectionState['showSearch'];
    disabled?: MetricsFilterSectionState['disabled'];
    active?: MetricsFilterSectionState['active'];
  }) {
    super({
      key,
      type,
      title,
      description,
      icon,
      groups: [],
      computeGroups,
      selectedGroups: [],
      loading: true,
      showHideEmpty: showHideEmpty ?? true,
      showSearch: showSearch ?? true,
      disabled: disabled ?? false,
      active: active ?? false,
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

    const { selectedGroups } = this.state;

    this.setState({
      loading: filteredMetricsVariable.state.loading,
      active: selectedGroups.length > 0,
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

  private onSelectionChange = (selectedGroups: MetricsFilterSectionState['selectedGroups']) => {
    this.setState({ selectedGroups, active: selectedGroups.length > 0 });

    this.publishEvent(
      new EventFiltersChanged({ type: this.state.type, filters: selectedGroups.map((g) => g.value) }),
      true
    );

    this.publishEvent(
      new EventSectionValueChanged({ key: this.state.key, values: selectedGroups.map((g) => g.label) }),
      true
    );

    // Track rule filter selection events
    if (this.state.key === 'filters-rule' && selectedGroups.length > 0) {
      // Map the label to the appropriate filter_type for the event
      selectedGroups.forEach((group) => {
        let filterType: 'non_rules_metrics' | 'recording_rules' | 'alerting_rules';

        switch (group.label) {
          case ruleGroupLabels.metrics:
            filterType = 'non_rules_metrics';
            break;
          case ruleGroupLabels.rules:
            filterType = 'recording_rules';
            break;
          default:
            return; // Skip if it's not a recognized rules filter
        }

        reportExploreMetrics('sidebar_rules_filter_selected', { filter_type: filterType });
      });
    }
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
