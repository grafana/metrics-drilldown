import { css } from '@emotion/css';
import {
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type MultiValueVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';

import { computeMetricCategories } from 'WingmanDataTrail/MetricsVariables/computeMetricCategories';
import { computeMetricPrefixGroups } from 'WingmanDataTrail/MetricsVariables/computeMetricPrefixGroups';
import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import {
  VAR_METRICS_VARIABLE,
  type MetricOptions,
  type MetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/MetricsVariable';

import { Dropdown } from './Dropdown';
import { EventGroupFiltersChanged } from './EventGroupFiltersChanged';
import { FilterPopup } from './FilterPopup';

interface MetricsFilterState extends SceneObjectState {
  type: 'prefixes' | 'categories';
  placeholder: string;
  groups: Array<{ label: string; value: string; count: number }>;
  selectedGroups: string[];
  loading: boolean;
}

export class MetricsFilter extends SceneObjectBase<MetricsFilterState> {
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

  constructor(state: { type: MetricsFilterState['type'] }) {
    super({
      key: `metrics-${state.type}+filter`,
      type: state.type,
      placeholder: state.type === 'prefixes' ? 'Metric prefixes' : 'Metric categories',
      groups: [],
      selectedGroups: [],
      loading: false,
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

    this._subs.add(
      filteredMetricsVariable.subscribeToState((newState, prevState) => {
        if (!prevState.loading && newState.loading) {
          this.setState({ loading: true });
        } else if (prevState.loading && !newState.loading) {
          this.setState({ loading: false });
        }
      })
    );
  }

  private updateLists(options: MetricOptions) {
    this.setState({
      groups: this.state.type === 'prefixes' ? computeMetricPrefixGroups(options) : computeMetricCategories(options),
    });
  }

  private updateCounts(filteredOptions: MetricOptions) {
    console.log('[TODO] MetricsFilter.updateCounts', filteredOptions.length);
  }

  onChangeUpdateGroups = (groupValues: string[]) => {
    this.publishEvent(new EventGroupFiltersChanged({ type: this.state.type, groups: groupValues }), true);
    this.setState({ selectedGroups: groupValues });
  };

  static Component = ({ model }: SceneComponentProps<MetricsFilter>) => {
    const styles = useStyles2(getStyles);
    const { placeholder, groups, selectedGroups } = model.useState();
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);
    const icon = isOverlayOpen ? 'angle-up' : 'angle-down';

    const onClickOk = (groupValues: string[]) => {
      model.onChangeUpdateGroups(groupValues);
      setIsOverlayOpen(false);
    };

    const onClickCancel = () => {
      setIsOverlayOpen(false);
    };

    const hasSelectedGroups = selectedGroups.length > 0;
    const selectedGroupsList = selectedGroups.map((g) => groups.find(({ value }) => value === g)?.label).join(', ');

    return (
      <div>
        <Dropdown
          isOpen={isOverlayOpen}
          overlay={
            <FilterPopup
              items={groups}
              selectedGroups={selectedGroups}
              onClickCancel={onClickCancel}
              onClickOk={onClickOk}
            />
          }
          onVisibleChange={setIsOverlayOpen}
        >
          <Button
            variant="secondary"
            fill="outline"
            className={styles.button}
            tooltip={hasSelectedGroups ? `${placeholder} applied: ${selectedGroupsList}` : undefined}
            tooltipPlacement="top"
          >
            <>
              <div className={styles.buttonContent}>
                {placeholder}
                {hasSelectedGroups && (
                  <>
                    <span>:&nbsp;</span>
                    {selectedGroupsList}
                  </>
                )}
                &nbsp;
              </div>
              <Icon name={icon} />
            </>
          </Button>
        </Dropdown>
      </div>
    );
  };
}

const getStyles = () => {
  return {
    button: css`
      max-width: 360px;
    `,
    buttonContent: css`
      max-width: 320px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    `,
  };
};
