import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type MultiValueVariable,
  type SceneComponentProps,
  type SceneObjectState,
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

import { CheckBoxList } from './CheckBoxList';

interface MetricsFilterSectionState extends SceneObjectState {
  key: string;
  title: string;
  type: 'prefixes' | 'categories';
  groups: Array<{ label: string; value: string; count: number }>;
  computeGroups: (
    options: Array<{ label: string; value: string }>
  ) => Array<{ label: string; value: string; count: number }>;
  selectedFilters: string[];
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
    title,
    type,
    computeGroups,
  }: {
    title: MetricsFilterSectionState['title'];
    type: MetricsFilterSectionState['type'];
    computeGroups: MetricsFilterSectionState['computeGroups'];
  }) {
    super({
      key: `metrics-filter-section-${type}`,
      title,
      type,
      groups: [],
      computeGroups,
      selectedFilters: [],
      loading: true,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const metricsVariable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MetricsVariable;

    this.updateLists(metricsVariable.state.options as MetricOptions);

    const filteredMetricsVariable = sceneGraph.lookupVariable(
      VAR_FILTERED_METRICS_VARIABLE,
      this
    ) as FilteredMetricsVariable;

    this.updateCounts(filteredMetricsVariable.state.options as MetricOptions);

    this.setState({ loading: !filteredMetricsVariable.state.options.length });
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

  public static Component = ({ model }: SceneComponentProps<MetricsFilterSection>) => {
    const styles = useStyles2(getStyles);
    const { type, title, groups, selectedFilters, loading } = model.useState();

    const [hideEmpty, setHideEmpty] = useState(true);
    const [searchValue, setSearchValue] = useState('');

    const filteredList = useMemo(() => {
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

    const onSelectionChange = (filters: string[]) => {
      model.setState({ selectedFilters: filters });
      model.publishEvent(new EventFiltersChanged({ type, filters }));
    };

    return (
      <div className={styles.container}>
        <h5 className={styles.header}>
          <div>
            {title}
            <span className={styles.count}>({loading ? '0' : filteredList.length})</span>
          </div>
          <div className={styles.switchContainer}>
            <span className={styles.switchLabel}>Hide empty</span>
            <Switch value={hideEmpty} onChange={(e) => setHideEmpty(e.currentTarget.checked)} />
          </div>
        </h5>

        <Input
          className={styles.search}
          prefix={<Icon name="search" />}
          placeholder="Search..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          suffix={
            <IconButton name="times" variant="secondary" tooltip="Clear search" onClick={(e) => setSearchValue('')} />
          }
        />

        {loading && <Spinner inline />}

        {!loading && (
          <CheckBoxList
            filteredList={filteredList}
            selectedValues={selectedFilters}
            onSelectionChange={onSelectionChange}
          />
        )}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      width: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
      overflowY: 'hidden',
    }),
    header: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing(1),
      fontSize: '14px',
      marginBottom: theme.spacing(1),
      padding: theme.spacing(0, 0.5),
    }),
    count: css({
      display: 'inline-block',
      color: theme.colors.text.secondary,
      fontSize: '12px',
      marginLeft: theme.spacing(0.5),
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
    search: css({
      flexBasis: '32px',
      flexShrink: 0,
      marginBottom: theme.spacing(1),
      padding: theme.spacing(0, 0.5),
    }),
  };
}
