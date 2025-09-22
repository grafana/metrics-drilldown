import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  VariableDependencyConfig,
  type MultiValueVariable,
  type SceneComponentProps,
  type SceneObjectState,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { Combobox, Icon, InlineField, InlineLabel, Tooltip, useStyles2, type ComboboxOption } from '@grafana/ui';
import React from 'react';

import { getMultiVariableValues } from 'MetricsReducer/components/SceneByVariableRepeater';
import { computeMetricPrefixGroups } from 'MetricsReducer/metrics-variables/computeMetricPrefixGroups';
import { VAR_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { EventFiltersChanged } from 'MetricsReducer/SideBar/sections/MetricsFilterSection/EventFiltersChanged';

interface PrefixFilterDropdownState extends SceneObjectState {
  loading: boolean;
  error: Error | null;
  options: ComboboxOption[];
  value: string;
}

const METRIC_PREFIX_ALL_OPTION = {
  label: 'All metric names',
  value: 'all',
};

export class PrefixFilterDropdown extends SceneObjectBase<PrefixFilterDropdownState> {
  protected _variableDependency: VariableDependencyConfig<PrefixFilterDropdownState> = new VariableDependencyConfig(
    this,
    {
      variableNames: [VAR_METRICS_VARIABLE],
      onVariableUpdateCompleted: () => this.parseMetricPrefixes(),
    }
  );

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['metricPrefix'] });

  getUrlState() {
    return { metricPrefix: this.state.value };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.metricPrefix === 'string') {
      if (this.state.value !== values.metricPrefix) {
        this.setState({ value: values.metricPrefix });
      }
      return;
    }

    this.setState({ value: METRIC_PREFIX_ALL_OPTION.value });
  }

  constructor(state: Partial<PrefixFilterDropdownState>) {
    super({
      ...state,
      key: 'related-prefix-filter',
      loading: true,
      error: null,
      options: [METRIC_PREFIX_ALL_OPTION],
      value: METRIC_PREFIX_ALL_OPTION.value,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.parseMetricPrefixes();
  }

  private parseMetricPrefixes() {
    if (this._variableDependency.hasDependencyInLoadingState()) {
      this.setState({ error: undefined, loading: true });
      return;
    }

    const filteredMetricsVariable = sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MultiValueVariable;

    if (filteredMetricsVariable.state.error) {
      this.setState({
        error: filteredMetricsVariable.state.error,
        loading: false,
        options: [],
      });
      return;
    }

    const prefixGroups = computeMetricPrefixGroups(
      getMultiVariableValues(filteredMetricsVariable) as Array<{ label: string; value: string }>
    );

    const newOptions = [
      METRIC_PREFIX_ALL_OPTION,
      ...prefixGroups.map((g) => ({
        value: g.value,
        label: `${g.label} (${g.count})`,
      })),
    ];

    const { value } = this.state;
    const newValue = newOptions.find((o) => o.value === value) ? (value as string) : METRIC_PREFIX_ALL_OPTION.value;

    this.setState({
      error: null,
      loading: false,
      options: newOptions,
    });

    this.selectOption({ value: newValue, label: newValue });
  }

  private selectOption = (option: ComboboxOption | null) => {
    const value = option === null ? METRIC_PREFIX_ALL_OPTION.value : option.value;

    this.setState({ value });

    this.publishEvent(
      new EventFiltersChanged({
        type: 'prefixes',
        filters: value === METRIC_PREFIX_ALL_OPTION.value ? [] : [value],
      }),
      true
    );
  };

  public static readonly Component = ({ model }: SceneComponentProps<PrefixFilterDropdown>) => {
    const styles = useStyles2(getStyles);
    const { loading, options, value, error } = model.useState();

    return (
      <div className={styles.container} data-testid="prefix-filter-selector">
        <InlineField
          disabled={loading}
          error={error && error.toString()}
          label={
            <InlineLabel width="auto" className={styles.label}>
              <span>View by</span>
              <Tooltip
                content="View by the metric prefix. A metric prefix is a single word at the beginning of the metric name, relevant to the domain the metric belongs to."
                placement="top"
              >
                <Icon className={styles.tooltipIcon} name="info-circle" size="sm" />
              </Tooltip>
            </InlineLabel>
          }
        >
          <Combobox value={value} onChange={model.selectOption} options={options} />
        </InlineField>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      display: flex;

      & > div {
        margin: 0;
      }
    `,

    label: css`
      margin-right: 0;
      background-color: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.medium};
      border-right: 0 none;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    `,
    tooltipIcon: css`
      margin-left: ${theme.spacing(0.5)};
    `,
  };
}
