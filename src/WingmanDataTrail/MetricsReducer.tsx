import { css } from '@emotion/css';
import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Checkbox, Field, FieldSet, Icon, Input, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useState } from 'react';

import { MetricsGroupByList } from './GroupBy/MetricsGroupByList';
import { HeaderControls } from './HeaderControls/HeaderControls';
import { SimpleMetricsList } from './MetricVizPanel/SimpleMetricsList';

interface MetricsReducerState extends SceneObjectState {
  headerControls: HeaderControls;
  body: MetricsGroupByList | SimpleMetricsList;
  hideEmpty: boolean;
  searchQuery: string;
  groupBy: string;
  sortBy: string;
  viewMode: 'rows' | 'grid';
  hideEmptyGroups: boolean;
  hideEmptyTypes: boolean;
  selectedMetricGroups: string[];
  selectedMetricTypes: string[];
  groups: Record<string, Array<{ name: string; metrics: string[] }>>;
  metricsGroupSearch: string;
  metricsTypeSearch: string;
}

// Move these outside the class, at the top level of the file (after the imports)
interface MetricsFilterSectionProps {
  title: string;
  items: Array<{ label: string; value: string }>;
  hideEmpty: boolean;
  searchValue: string;
  selectedValues: string[];
  onHideEmptyChange: (checked: boolean) => void;
  onSearchChange: (value: string) => void;
  onSelectionChange: (values: string[]) => void;
}

const MetricsFilterSection: React.FC<MetricsFilterSectionProps> = ({
  title,
  items,
  hideEmpty,
  searchValue,
  selectedValues,
  onHideEmptyChange,
  onSearchChange,
  onSelectionChange,
}) => {
  const styles = useStyles2(getStyles);

  // Local state for immediate input value
  const [inputValue, setInputValue] = useState(searchValue);

  // Add debounced search
  const debouncedSearch = useCallback(
    (value: string) => {
      const timeoutId = setTimeout(() => {
        onSearchChange(value);
      }, 250);
      return () => clearTimeout(timeoutId);
    },
    [onSearchChange]
  );

  // Update debounced search when input changes
  useEffect(() => {
    const cleanup = debouncedSearch(inputValue);
    return cleanup;
  }, [inputValue, debouncedSearch]);

  // Update local input when searchValue prop changes
  useEffect(() => {
    setInputValue(searchValue);
  }, [searchValue]);

  // Calculate counts - just use total count for display
  const totalCount = items.length;
  const displayCount = totalCount; // Always show total count, regardless of hideEmpty

  // Create full list with "All" option
  const fullList = [{ label: `All (${displayCount})`, value: 'all' }, ...items];

  // Filter the list - use searchValue instead of inputValue
  const filteredList = fullList.filter((item) => {
    const matchesSearch = item.label.toLowerCase().includes(searchValue.toLowerCase());
    if (hideEmpty && item.value !== 'all') {
      const count = parseInt(item.label.match(/\((\d+)\)/)?.[1] ?? '0', 10);
      return matchesSearch && count > 0;
    }
    return matchesSearch;
  });

  return (
    <FieldSet label={title}>
      <div className={styles.fieldSetContent}>
        <Field>
          <Checkbox label="Hide empty" value={hideEmpty} onChange={(e) => onHideEmptyChange(e.currentTarget.checked)} />
        </Field>
        <Field>
          <Input
            prefix={<Icon name="search" />}
            placeholder="Search..."
            value={inputValue}
            onChange={(e) => setInputValue(e.currentTarget.value)}
          />
        </Field>
        <div className={styles.checkboxList}>
          {filteredList.map((item) => (
            <Field key={item.value}>
              <Checkbox
                label={item.label}
                value={selectedValues.includes(item.value)}
                onChange={(e) => {
                  const newValues = e.currentTarget.checked
                    ? [...selectedValues, item.value]
                    : selectedValues.filter((v) => v !== item.value);
                  onSelectionChange(newValues);
                }}
              />
            </Field>
          ))}
        </div>
      </div>
    </FieldSet>
  );
};

export class MetricsReducer extends SceneObjectBase<MetricsReducerState> {
  public constructor(state: any) {
    // TEMP: remove this in favour of a groupBy variable dependency instead
    const headerControlsOptions = {
      onChange: (option: SelectableValue<string>) => {
        console.log('groupBy option selected', option);
      },
    };

    const initialState: MetricsReducerState = {
      ...state,
      headerControls: new HeaderControls(headerControlsOptions),
      hideEmpty: true,
      searchQuery: '',
      groupBy: 'cluster',
      sortBy: 'name',
      viewMode: 'grid' as const,
      hideEmptyGroups: true,
      hideEmptyTypes: true,
      selectedMetricGroups: [],
      selectedMetricTypes: [],
      metricsGroupSearch: '',
      metricsTypeSearch: '',
      // body: new MetricsGroupByList({}),
      body: new SimpleMetricsList(),
    };

    super(initialState);

    // TEMP: remove this in favour of a groupBy variable dependency instead
    headerControlsOptions.onChange = (option: SelectableValue<string>) => {
      this.setState({
        body: !option.value || option.value === 'none' ? new SimpleMetricsList() : new MetricsGroupByList({}),
      });
    };
  }

  // Update MetricsSidebar to use the new component
  private MetricsSidebar = () => {
    const {
      hideEmptyGroups,
      hideEmptyTypes,
      selectedMetricGroups,
      selectedMetricTypes,
      metricsGroupSearch,
      metricsTypeSearch,
    } = this.useState();
    const styles = useStyles2(getStyles);

    const baseMetricGroups = [
      { label: 'alloy (57)', value: 'alloy' },
      { label: 'apollo (0)', value: 'apollo' },
      { label: 'grafana (33)', value: 'grafana' },
      { label: 'prometheus (45)', value: 'prometheus' },
      { label: 'loki (0)', value: 'loki' },
      { label: 'tempo (19)', value: 'tempo' },
      { label: 'mimir (23)', value: 'mimir' },
      { label: 'cortex (0)', value: 'cortex' },
      { label: 'thanos (41)', value: 'thanos' },
      { label: 'jaeger (25)', value: 'jaeger' },
      { label: 'k8s (63)', value: 'k8s' },
    ];

    const baseMetricTypes = [
      { label: 'request (12)', value: 'request' },
      { label: 'response (0)', value: 'response' },
      { label: 'duration (7)', value: 'duration' },
      { label: 'total (0)', value: 'total' },
      { label: 'latency (8)', value: 'latency' },
      { label: 'errors (5)', value: 'errors' },
      { label: 'bytes (0)', value: 'bytes' },
      { label: 'connections (6)', value: 'connections' },
      { label: 'memory (4)', value: 'memory' },
      { label: 'cpu (9)', value: 'cpu' },
      { label: 'disk (5)', value: 'disk' },
      { label: 'network (7)', value: 'network' },
    ];

    return (
      <div className={styles.sidebar}>
        <MetricsFilterSection
          title="Metrics group"
          items={baseMetricGroups}
          hideEmpty={hideEmptyGroups}
          searchValue={metricsGroupSearch}
          selectedValues={selectedMetricGroups}
          onHideEmptyChange={(checked) => this.setState({ hideEmptyGroups: checked })}
          onSearchChange={(value) => this.setState({ metricsGroupSearch: value })}
          onSelectionChange={(values) => this.setState({ selectedMetricGroups: values })}
        />

        <MetricsFilterSection
          title="Metrics types"
          items={baseMetricTypes}
          hideEmpty={hideEmptyTypes}
          searchValue={metricsTypeSearch}
          selectedValues={selectedMetricTypes}
          onHideEmptyChange={(checked) => this.setState({ hideEmptyTypes: checked })}
          onSearchChange={(value) => this.setState({ metricsTypeSearch: value })}
          onSelectionChange={(values) => this.setState({ selectedMetricTypes: values })}
        />
      </div>
    );
  };

  public static Component = ({ model }: SceneComponentProps<MetricsReducer>) => {
    const styles = useStyles2(getStyles);
    const { body, headerControls } = model.useState();

    return (
      <div className={styles.container}>
        <div className={styles.headerControls}>
          <headerControls.Component model={headerControls} />
        </div>
        <div className={styles.content}>
          <model.MetricsSidebar />

          <div className={styles.mainContent}>
            <body.Component model={body as any} />
          </div>
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: theme.spacing(1),
    }),
    headerControls: css({}),
    content: css({
      display: 'flex',
      flexGrow: 1,
      gap: theme.spacing(2),
      height: '100%',
      overflow: 'hidden',
    }),
    sidebar: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      padding: theme.spacing(1),
      width: '250px',
      height: '100%',
      overflow: 'hidden',
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
    }),
    mainContent: css({
      flexGrow: 1,
      overflow: 'auto',
      padding: theme.spacing(1),
    }),
    clusterSection: css({
      marginBottom: theme.spacing(3),
      '& h3': {
        marginBottom: theme.spacing(2),
      },
    }),
    fieldSetContent: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
      maxHeight: '400px',
    }),
    checkboxList: css({
      overflowY: 'scroll',
      flexGrow: 1,
      paddingRight: theme.spacing(1),
    }),
  };
}
