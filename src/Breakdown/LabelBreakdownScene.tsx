import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  sceneGraph,
  SceneObjectBase,
  type QueryVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React, { useCallback } from 'react';

import { RefreshMetricsEvent, VAR_FILTERS, VAR_GROUP_BY } from '../shared';
import { createDefaultGroupBySelectorConfig, GroupBySelector } from './GroupBySelector';
import { isAdHocFiltersVariable, isQueryVariable } from '../utils/utils.variables';
import { MetricLabelsList } from './MetricLabelsList/MetricLabelsList';
import { MetricLabelValuesList } from './MetricLabelValuesList/MetricLabelValuesList';

interface LabelBreakdownSceneState extends SceneObjectState {
  metric: string;
  body?: MetricLabelsList | MetricLabelValuesList;
}

export class LabelBreakdownScene extends SceneObjectBase<LabelBreakdownSceneState> {
  constructor({ metric }: { metric: LabelBreakdownSceneState['metric'] }) {
    super({
      metric,
      body: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const groupByVariable = this.getVariable();

    groupByVariable.subscribeToState((newState, oldState) => {
      if (newState.value !== oldState.value) {
        this.updateBody(groupByVariable);
      }
    });

    if (config.featureToggles.enableScopesInMetricsExplore) {
      this.subscribeToEvent(RefreshMetricsEvent, () => {
        this.updateBody(groupByVariable);
      });
    }

    this.updateBody(groupByVariable);
  }

  private getVariable(): QueryVariable {
    const groupByVariable = sceneGraph.lookupVariable(VAR_GROUP_BY, this)!;
    if (!isQueryVariable(groupByVariable)) {
      throw new Error('Group by variable not found');
    }
    return groupByVariable;
  }

  private updateBody(groupByVariable: QueryVariable) {
    const { metric } = this.state;

    this.setState({
      body: groupByVariable.hasAllValue()
        ? new MetricLabelsList({ metric })
        : new MetricLabelValuesList({ metric, label: groupByVariable.state.value as string }),
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const styles = useStyles2(getStyles);
    const { body } = model.useState();
    const groupByVariable = model.getVariable();

    const { options, value: rawValue } = groupByVariable.useState();
    // Map the variable's all value to "All" for the component
    const value = groupByVariable.hasAllValue() ? 'All' : rawValue;
    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, model);

    // Convert filters for the component
    const filters = isAdHocFiltersVariable(filtersVariable)
      ? filtersVariable.state.filters.map((f: any) => ({
          key: f.key,
          operator: f.operator,
          value: f.value
        }))
      : [];

    // If there are 4 or fewer total options (including "All"), show all labels as radio buttons
    // Otherwise, use the dropdown
    const totalOptions = options.length + 1; // +1 for "All" option
    const shouldShowAllAsRadio = totalOptions <= 4;

    // Get all available labels (excluding "All" which will be handled separately)
    const radioAttributes = shouldShowAllAsRadio
      ? options.map(option => option.value as string).filter(value => value !== '$__all')
      : [];

    // Get metrics domain configuration
    const metricsConfig = createDefaultGroupBySelectorConfig();

    // Memoize onChange handler to prevent unnecessary re-renders
    const handleChange = useCallback((selectedValue: string, ignore?: boolean) => {
      // Map "All" to the variable's all value
      const variableValue = selectedValue === 'All' ? '$__all' : selectedValue;
      // Pass isUserAction=true only for real user interactions so URL/history updates
      groupByVariable.changeValueTo(variableValue, undefined, !ignore);
    }, [groupByVariable]);

    // Configure filtering rules
    const filteringRules = {
      ...metricsConfig.filteringRules,
      // Filter out histogram bucket labels like the original GroupByVariable
      customAttributeFilter: (attribute: string) => {
        const shouldShow = attribute !== 'le';
        return shouldShow;
      },
      // Disable excludeFilteredFromRadio for metrics to always show radio buttons
      excludeFilteredFromRadio: false
    };

    // Configure layout
    const layoutConfig = {
      ...metricsConfig.layoutConfig,
      additionalWidthPerItem: 40, // Increase width per item to ensure radio buttons fit
      widthOfOtherAttributes: 100, // Reduce dropdown width to make room for radio buttons
    };

    // Configure search
    const searchConfig = {
      ...metricsConfig.searchConfig,
      enabled: true,
      maxOptions: 100,
    };

    return (
      <div className={styles.container}>
        <div className={styles.controls}>
          <div className={`${styles.groupBySelector} ${options.length <= 3 ? styles.selectedValue : ''}`} data-testid="breakdown-label-selector">
            <GroupBySelector
              // Core selection interface
              options={options as Array<{ label?: string; value: string }>}
              radioAttributes={radioAttributes} // Common Prometheus labels as radio buttons
              value={value as string}
              onChange={handleChange}
              showAll={true}

              // State data extracted manually
              filters={filters}
              currentMetric={undefined} // Could be enhanced to extract current metric
              initialGroupBy={undefined} // Could be enhanced if needed

              // Display configuration
              fieldLabel="By label"
              selectPlaceholder="More labels..."

              // Apply metrics domain defaults with memoized overrides
              {...metricsConfig}
              filteringRules={filteringRules}
              layoutConfig={layoutConfig}
              searchConfig={searchConfig}
            />
          </div>
          {body instanceof MetricLabelsList && <body.Controls model={body} />}
          {body instanceof MetricLabelValuesList && <body.Controls model={body} />}
        </div>
        <div data-testid="panels-list">
          {body instanceof MetricLabelsList && <body.Component model={body} />}
          {body instanceof MetricLabelValuesList && <body.Component model={body} />}
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
      paddingTop: theme.spacing(1),
    }),
    controls: css({
      flexGrow: 0,
      display: 'flex',
      gap: theme.spacing(2),
      height: '77px',
      justifyContent: 'space-between',
      alignItems: 'end',
      overflowX: 'auto',
    }),
    searchField: css({
      flexGrow: 1,
    }),
    groupBySelector: css({
      flexGrow: 1,
    }),
    selectedValue: css({
      // prevent flickering on wider screens
      '@media (min-width: 500px)': {
        width: '380px',
      },
    }),
  };
}
