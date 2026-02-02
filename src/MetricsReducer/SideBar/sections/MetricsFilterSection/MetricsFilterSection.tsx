import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
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

import {
  computeMetricPrefixSecondLevel,
  HIERARCHICAL_SEPARATOR,
} from 'MetricsReducer/metrics-variables/computeMetricPrefixSecondLevel';
import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from 'MetricsReducer/metrics-variables/FilteredMetricsVariable';
import {
  VAR_METRICS_VARIABLE,
  type MetricOptions,
  type MetricsVariable,
} from 'MetricsReducer/metrics-variables/MetricsVariable';
import {
  MetricsVariableFilterEngine,
  type MetricFilters,
} from 'MetricsReducer/metrics-variables/MetricsVariableFilterEngine';
import { MetricsReducer } from 'MetricsReducer/MetricsReducer';
import {
  RULE_GROUP_LABELS,
  RULE_REGEX_TO_LABEL,
  type RuleGroupLabel,
} from 'MetricsReducer/SideBar/sections/MetricsFilterSection/rule-group-labels';
import { logger } from 'shared/logger/logger';

import { reportExploreMetrics } from '../../../../shared/tracking/interactions';
import { EventSectionValueChanged } from '../EventSectionValueChanged';
import { SectionTitle } from '../SectionTitle';
import { type SideBarSectionState } from '../types';
import { CheckBoxList } from './CheckBoxList';
import { EventFiltersChanged } from './EventFiltersChanged';
import { TreeCheckBoxList } from './TreeCheckBoxList';

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
  hierarchical: boolean;
  expandedPrefixes: Set<string>;
  computedSublevels: Map<string, Array<{ label: string; value: string; count: number }>>;
}

export class MetricsFilterSection extends SceneObjectBase<MetricsFilterSectionState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_METRICS_VARIABLE, VAR_FILTERED_METRICS_VARIABLE],
    onReferencedVariableValueChanged: (variable) => {
      const { name, options } = (variable as MultiValueVariable).state;

      if (name === VAR_METRICS_VARIABLE) {
        this.updateLists(options as MetricOptions);
        return;
      }

      if (name === VAR_FILTERED_METRICS_VARIABLE) {
        this.updateCounts();
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
        .map((v) => v.trim())
        .filter((v) => v)
        .map((v) => ({
          label: this.parseLabel(v) as RuleGroupLabel,
          value: v,
        }));
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
    hierarchical,
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
    hierarchical?: MetricsFilterSectionState['hierarchical'];
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
      hierarchical: hierarchical ?? false,
      expandedPrefixes: new Set(),
      computedSublevels: new Map(),
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
    this.updateCounts();

    const { selectedGroups, hierarchical } = this.state;

    this.setState({
      loading: filteredMetricsVariable.state.loading,
      active: selectedGroups.length > 0,
    });

    // Auto-expand and compute Level 1 for any hierarchical selections from URL
    if (hierarchical) {
      const prefixesToExpand = new Set<string>();

      selectedGroups.forEach((group) => {
        if (group.value.includes(HIERARCHICAL_SEPARATOR)) {
          const [prefix] = group.value.split(HIERARCHICAL_SEPARATOR);
          prefixesToExpand.add(prefix);
        }
      });

      if (prefixesToExpand.size > 0) {
        const options = metricsVariable.state.options as MetricOptions;
        const newComputedSublevels = new Map(this.state.computedSublevels);

        prefixesToExpand.forEach((prefix) => {
          if (!newComputedSublevels.has(prefix)) {
            const sublevels = computeMetricPrefixSecondLevel(options, prefix);
            newComputedSublevels.set(prefix, sublevels);
          }
        });

        this.setState({
          expandedPrefixes: prefixesToExpand,
          computedSublevels: newComputedSublevels,
        });
      }
    }
  }

  private updateLists(options: MetricOptions) {
    this.setState({
      groups: this.state.computeGroups(options),
      loading: false,
    });
  }

  private updateCounts() {
    const { groups, computeGroups, type } = this.state;

    // Access the original unfiltered options
    const metricsVariable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MetricsVariable;
    const originalOptions = metricsVariable.state.options as MetricOptions;

    const metricsReducer = sceneGraph.getAncestor(this, MetricsReducer);
    const filterEngine = metricsReducer.state.enginesMap.get(VAR_FILTERED_METRICS_VARIABLE)?.filterEngine;

    if (!filterEngine) {
      logger.warn('MetricsFilterSection: No filter engine found');
      return;
    }

    // Create a copy of current filters excluding the current filter type
    const filtersWithoutCurrentType = { ...filterEngine.getFilters(), [type]: [] };

    // Get options filtered by everything except the current filter type
    const optionsForCounting = MetricsVariableFilterEngine.getFilteredOptions(
      originalOptions,
      filtersWithoutCurrentType
    );

    // Calculate counts based on these options
    const newGroups = new Map<string, number>(
      computeGroups(optionsForCounting).map((option) => [option.label, option.count])
    );

    const newGroupsWithCount = groups.map((group) => ({
      ...group,
      count: newGroups.get(group.label) ?? 0,
    }));

    this.setState({
      groups: newGroupsWithCount,
      loading: false,
    });

    // Update sublevel counts if hierarchical mode
    if (this.state.hierarchical) {
      this.updateSublevelCounts(optionsForCounting);
    }
  }

  /**
   * Update metric counts for already-computed second-level substrings.
   * Called when filters change to refresh counts without recomputing the entire tree.
   * @param options Filtered metric options to count from
   */
  private updateSublevelCounts(options: MetricOptions) {
    const { computedSublevels } = this.state;
    const newComputedSublevels = new Map(computedSublevels);

    // Recompute counts for already-computed sublevels
    for (const [prefix, sublevels] of computedSublevels.entries()) {
      const updatedSublevels = computeMetricPrefixSecondLevel(options, prefix);
      const countMap = new Map(updatedSublevels.map((s) => [s.label, s.count]));

      const updatedSublevelsList = sublevels.map((sublevel) => ({
        ...sublevel,
        count: countMap.get(sublevel.label) ?? 0,
      }));

      newComputedSublevels.set(prefix, updatedSublevelsList);
    }

    this.setState({ computedSublevels: newComputedSublevels });
  }

  /**
   * Handle expanding/collapsing a prefix to show/hide its second-level substrings.
   * Lazily computes sublevels on first expansion for performance.
   * @param prefix The parent prefix to expand/collapse (e.g., "grafana")
   */
  private onExpandToggle = (prefix: string) => {
    const { expandedPrefixes, computedSublevels } = this.state;
    const newExpanded = new Set(expandedPrefixes);
    let newComputedSublevels = computedSublevels;

    if (newExpanded.has(prefix)) {
      // Collapse
      newExpanded.delete(prefix);
    } else {
      // Expand - compute Level 1 if not already computed
      newExpanded.add(prefix);

      if (!computedSublevels.has(prefix)) {
        const metricsVariable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MetricsVariable;
        const options = metricsVariable.state.options as MetricOptions;

        const sublevels = computeMetricPrefixSecondLevel(options, prefix);
        newComputedSublevels = new Map(computedSublevels);
        newComputedSublevels.set(prefix, sublevels);
      }

      // Track hierarchical prefix expansion
      reportExploreMetrics('sidebar_hierarchical_prefix_opened', { prefix });
    }

    // Single setState call with all changes
    this.setState({
      expandedPrefixes: newExpanded,
      computedSublevels: newComputedSublevels,
    });
  };

  /**
   * Parse a filter value into a user-friendly label for display.
   * Handles rule regex patterns, hierarchical values, and regular labels.
   * @param value The filter value from URL or selection
   * @returns Formatted label for display
   */
  private parseLabel(value: string): string {
    // Check if it's a rule regex pattern first
    if (value in RULE_REGEX_TO_LABEL) {
      return RULE_REGEX_TO_LABEL[value];
    }

    // Handle hierarchical prefixes (e.g., "grafana::alert" -> "grafana > alert")
    if (value.includes(HIERARCHICAL_SEPARATOR)) {
      const [prefix, sublevel] = value.split(HIERARCHICAL_SEPARATOR);
      return `${prefix} > ${sublevel}`;
    }

    // Return value as-is for regular labels
    return value;
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

    if (this.state.type === 'prefixes') {
      reportExploreMetrics('sidebar_prefix_filter_applied', {
        filter_count: selectedGroups.length,
      });
    } else if (this.state.type === 'suffixes') {
      reportExploreMetrics('sidebar_suffix_filter_applied', {
        filter_count: selectedGroups.length,
      });
    }

    // Track rule filter selection events
    if (this.state.key === 'filters-rule' && selectedGroups.length > 0) {
      // Map the label to the appropriate filter_type for the event
      selectedGroups.forEach((group) => {
        let filterType: 'non_rules_metrics' | 'recording_rules' | 'alerting_rules';

        switch (group.label) {
          case RULE_GROUP_LABELS.metrics:
            filterType = 'non_rules_metrics';
            break;
          case RULE_GROUP_LABELS.rules:
            filterType = 'recording_rules';
            break;
          default:
            return; // Skip if it's not a recognized rules filter
        }

        reportExploreMetrics('sidebar_rules_filter_selected', { filter_type: filterType });
      });
    }
  };

  public static readonly Component = ({ model }: SceneComponentProps<MetricsFilterSection>) => {
    const styles = useStyles2(getStyles);
    const {
      groups,
      selectedGroups,
      loading,
      title,
      description,
      showHideEmpty,
      showSearch,
      hierarchical,
      expandedPrefixes,
      computedSublevels,
    } = model.useState();

    const [hideEmpty, setHideEmpty] = useState(false);
    const [searchValue, setSearchValue] = useState('');

    const switchId = `hide-empty-switch-${model.state.key}`;

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
            <label className={styles.switchLabel} htmlFor={switchId}>
              {t('sidebar.filter.hide-empty', 'Hide empty')}
            </label>
            <Switch id={switchId} value={hideEmpty} onChange={(e) => setHideEmpty(e.currentTarget.checked)} />
          </div>
        )}

        {showSearch && (
          <Input
            className={styles.searchInput}
            prefix={<Icon name="search" />}
            placeholder={t('sidebar.filter.search-placeholder', 'Search...')}
            value={searchValue}
            onChange={(e) => setSearchValue(e.currentTarget.value)}
            onKeyDown={onKeyDown}
            suffix={
              <IconButton
                name="times"
                variant="secondary"
                tooltip={t('sidebar.filter.clear-search-tooltip', 'Clear search')}
                aria-label={t('sidebar.filter.clear-search-tooltip', 'Clear search')}
                onClick={() => setSearchValue('')}
              />
            }
          />
        )}

        {loading && <Spinner inline />}

        {!loading && hierarchical && (
          <TreeCheckBoxList
            groups={filteredGroups}
            selectedGroups={selectedGroups}
            expandedPrefixes={expandedPrefixes}
            computedSublevels={computedSublevels}
            onSelectionChange={model.onSelectionChange}
            onExpandToggle={model.onExpandToggle}
          />
        )}

        {!loading && !hierarchical && (
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
