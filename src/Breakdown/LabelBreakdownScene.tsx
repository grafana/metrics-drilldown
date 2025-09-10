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

import { reportExploreMetrics } from '../interactions';
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

    // Define common Prometheus metric labels for radio buttons
    // Ordered by importance - most common labels first
    const commonPrometheusLabels = [
      'instance',         // Most common - server/pod identifier
      'job',              // Most common - Prometheus job name
      'service',          // Very common - service name
      'method',           // Common for HTTP metrics
      'status_code',      // Common for HTTP metrics
      'code',             // Alternative to status_code
      'handler',          // Common for HTTP handlers
      '__name__',         // Metric name (less common as radio)
      'exported_job',     // Exported job name
      'exported_instance' // Exported instance name
    ];

    // Filter radio attributes to only include labels that exist in the current options
    const radioAttributes = commonPrometheusLabels.filter(label =>
      options.some(option => option.value === label)
    );

    // Get metrics domain configuration
    const metricsConfig = createDefaultGroupBySelectorConfig();

    // Memoize onChange handler to prevent unnecessary re-renders
    const handleChange = useCallback((selectedValue: string, ignore?: boolean) => {
      // Map "All" to the variable's all value
      const variableValue = selectedValue === 'All' ? '$__all' : selectedValue;
      groupByVariable.changeValueTo(variableValue);

      // Maintain analytics reporting like the original GroupByVariable
      if (selectedValue && !ignore) {
        reportExploreMetrics('groupby_label_changed', { label: selectedValue });
      }
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
      maxSelectWidth: 200,
      enableResponsiveRadioButtons: true, // Enable responsive radio buttons for common labels
      additionalWidthPerItem: 60, // Increase width per item to ensure radio buttons fit
      widthOfOtherAttributes: 180, // Reduce dropdown width to make room for radio buttons
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
          <div className={styles.groupBySelector} data-testid="breakdown-label-selector">
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
              selectPlaceholder="Select label..."

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
      height: '70px',
      justifyContent: 'space-between',
      alignItems: 'end',
    }),
    searchField: css({
      flexGrow: 1,
    }),
    groupBySelector: css({
      flexGrow: 1,
      '@media (min-width: 1080px)': {
        minWidth: 380,
      },
    }),
  };
}
