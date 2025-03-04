import { css } from '@emotion/css';
import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import {
  PanelBuilders,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneFlexItemLike,
  type SceneFlexItemState,
  type SceneObjectState,
} from '@grafana/scenes';
import { Checkbox, Field, FieldSet, Icon, Input, RadioButtonGroup, Select, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useState } from 'react';

interface MetricsReducerState extends SceneObjectState {
  body: SceneCSSGridLayout;
  searchQuery: string;
  groupBy: string;
  sortBy: string;
  viewMode: 'rows' | 'grid';
  hideEmptyGroups: boolean;
  hideEmptyTypes: boolean;
  selectedMetricGroups: string[];
  selectedMetricTypes: string[];
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

  // Calculate counts
  const totalCount = items.length;
  const nonEmptyCount = items.filter((item) => parseInt(item.label.match(/\((\d+)\)/)?.[1] ?? '0') > 0).length;
  const displayCount = hideEmpty ? nonEmptyCount : totalCount;

  // Create full list with "All" option
  const fullList = [{ label: `All (${displayCount})`, value: 'all' }, ...items];

  // Filter the list - use searchValue instead of inputValue
  const filteredList = fullList.filter((item) => {
    const matchesSearch = item.label.toLowerCase().includes(searchValue.toLowerCase());
    if (hideEmpty && item.value !== 'all') {
      const count = parseInt(item.label.match(/\((\d+)\)/)?.[1] ?? '0');
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
  private createMetricPanel(title: string) {
    return new SceneCSSGridItem({
      body: PanelBuilders.timeseries().setTitle(title).setOption('legend', { showLegend: false }).build(),
    });
  }

  public constructor(state: any) {
    const initialState: MetricsReducerState = {
      ...state,
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
      body: new SceneCSSGridLayout({
        templateColumns: '250px 1fr',
        children: [
          // Left sidebar
          new SceneCSSGridItem({
            body: new SceneFlexLayout({
              direction: 'column',
              children: [],
            }),
          }),
          // Main content
          new SceneCSSGridItem({
            body: new SceneFlexLayout({
              direction: 'column',
              children: [
                new SceneFlexLayout({
                  direction: 'column',
                  children: [
                    // us-west cluster
                    new SceneFlexItem({
                      body: new SceneCSSGridLayout({
                        templateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        children: [],
                      }),
                    }) as SceneFlexItemLike,
                    // south-east cluster
                    new SceneFlexItem({
                      body: new SceneCSSGridLayout({
                        templateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        children: [],
                      }),
                    }) as SceneFlexItemLike,
                  ],
                }),
              ],
            }),
          }),
        ],
      }),
    };

    super(initialState);

    // Add metric panels after super() call
    const mainContent = (initialState.body.state.children[1] as SceneCSSGridItem).state as SceneFlexItemState;
    const clusterLayout = (mainContent.body as SceneFlexLayout).state.children[0] as SceneFlexLayout;

    const usWestGrid = ((clusterLayout.state.children[0] as SceneFlexItem).state as SceneFlexItemState)
      .body as SceneCSSGridLayout;
    usWestGrid.setState({
      children: [
        this.createMetricPanel('alloy_request_duration'),
        this.createMetricPanel('grafana_total_mem_total'),
        this.createMetricPanel('grafana_request_duration'),
      ],
    });

    const southEastGrid = ((clusterLayout.state.children[1] as SceneFlexItem).state as SceneFlexItemState)
      .body as SceneCSSGridLayout;
    southEastGrid.setState({
      children: [
        this.createMetricPanel('alloy_request_duration'),
        this.createMetricPanel('grafana_total_mem_total'),
        this.createMetricPanel('grafana_request_duration'),
      ],
    });
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
    const { body, searchQuery, groupBy, sortBy, viewMode } = model.useState();
    const styles = useStyles2(getStyles);

    const groupByOptions: Array<SelectableValue<string>> = [
      { label: '(None)', value: 'none' },
      { label: 'Cluster', value: 'cluster' },
      { label: 'Namespace', value: 'namespace' },
      { label: 'Service', value: 'service' },
    ];

    const sortByOptions: Array<SelectableValue<string>> = [
      { label: 'Name', value: 'name' },
      { label: 'Value', value: 'value' },
    ];

    const viewModeOptions = [
      { label: 'Grid', value: 'grid' as const },
      { label: 'Rows', value: 'rows' as const },
    ];

    return (
      <div className={styles.container}>
        <div className={styles.controls}>
          <Field className={styles.searchField}>
            <Input
              prefix={<Icon name="search" />}
              placeholder="Search metrics..."
              value={searchQuery}
              onChange={(e) => model.setState({ searchQuery: e.currentTarget.value })}
            />
          </Field>

          <Field label="Group by">
            <Select value={groupBy} options={groupByOptions} onChange={(v) => model.setState({ groupBy: v.value! })} />
          </Field>

          <Field label="Sort">
            <Select value={sortBy} options={sortByOptions} onChange={(v) => model.setState({ sortBy: v.value! })} />
          </Field>

          <Field label="View">
            <RadioButtonGroup
              options={viewModeOptions}
              value={viewMode}
              onChange={(v) => model.setState({ viewMode: v as 'grid' | 'rows' })}
            />
          </Field>
        </div>
        <div className={styles.content}>
          <model.MetricsSidebar />
          <div className={styles.mainContent}>
            <div className={styles.clusterSection}>
              <h3>us-west cluster</h3>
              <body.Component model={body} />
            </div>
            <div className={styles.clusterSection}>
              <h3>south-east cluster</h3>
              <body.Component model={body} />
            </div>
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
    controls: css({
      display: 'flex',
      gap: theme.spacing(2),
      padding: theme.spacing(1),
      alignItems: 'flex-end',
      position: 'sticky',
      top: 0,
      backgroundColor: theme.colors.background.primary,
      zIndex: 1,
    }),
    searchField: css({
      flexGrow: 1,
      marginBottom: 0,
    }),
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
