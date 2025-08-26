import { css } from '@emotion/css';

import type { AdHocVariableFilter, GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  type QueryVariable,
  type SceneComponentProps,
} from '@grafana/scenes';
import { Button, Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import React, { memo, useCallback, useMemo } from 'react';

import { reportExploreMetrics } from '../../interactions';
import { ALL_VARIABLE_VALUE } from '../../services/variables';
import { VAR_FILTERS, VAR_GROUP_BY } from '../../shared';
import { logger } from '../../tracking/logger/logger';
import { isAdHocFiltersVariable, isQueryVariable } from '../../utils/utils.variables';

import { useLabelFiltering } from './hooks/useLabelFiltering';
import { useResizeObserver } from './hooks/useResizeObserver';
import { useTextMeasurement } from './hooks/useTextMeasurement';

import type { ResponsiveGroupBySelectorState } from './types';
import { DEFAULT_FONT_SIZE } from './utils/constants';
import { prioritizeLabels } from './utils/labelPriority';
import { calculateVisibleRadioOptions } from './utils/widthCalculations';

export class ResponsiveGroupBySelector extends SceneObjectBase<ResponsiveGroupBySelectorState> {
  // Memoized variable references to avoid repeated lookups
  private _groupByVariable?: QueryVariable;
  private _filtersVariable?: any;
  private _lastVariableCheck = 0;
  private readonly VARIABLE_CACHE_TTL = 1000; // 1 second cache

  constructor() {
    super({
      availableWidth: 0,
      commonLabels: [],
      allLabels: [],
      selectedLabel: null,
      fontSize: DEFAULT_FONT_SIZE,
    });
  }

  public getGroupByVariable(): QueryVariable {
    const now = Date.now();
    if (!this._groupByVariable || (now - this._lastVariableCheck) > this.VARIABLE_CACHE_TTL) {
      const groupByVariable = sceneGraph.lookupVariable(VAR_GROUP_BY, this)!;
      if (!isQueryVariable(groupByVariable)) {
        throw new Error('Group by variable not found');
      }
      this._groupByVariable = groupByVariable;
      this._lastVariableCheck = now;
    }
    return this._groupByVariable;
  }

  private getCurrentFilters(): AdHocVariableFilter[] {
    const now = Date.now();
    if (!this._filtersVariable || (now - this._lastVariableCheck) > this.VARIABLE_CACHE_TTL) {
      this._filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);
      this._lastVariableCheck = now;
    }
    
    if (isAdHocFiltersVariable(this._filtersVariable)) {
      return this._filtersVariable.state.filters;
    }
    return [];
  }

  public onRadioChange = (value: string) => {
    const startTime = performance.now();
    
    reportExploreMetrics('groupby_label_changed', {
      label: value,
    });

    const groupByVariable = this.getGroupByVariable();
    groupByVariable.changeValueTo(value);
    
    const endTime = performance.now();
    if (endTime - startTime > 16) { // More than one frame
      logger.warn('ResponsiveGroupBySelector: Radio change took', endTime - startTime, 'ms');
    }
  };

  public onSelectAll = () => {
    const startTime = performance.now();
    
    reportExploreMetrics('groupby_label_changed', {
      label: 'all',
    });

    const groupByVariable = this.getGroupByVariable();
    groupByVariable.changeValueTo(ALL_VARIABLE_VALUE);
    
    const endTime = performance.now();
    if (endTime - startTime > 16) {
      logger.warn('ResponsiveGroupBySelector: Select all took', endTime - startTime, 'ms');
    }
  };

  public static readonly Component = memo(function ResponsiveGroupBySelectorComponent({ model }: SceneComponentProps<ResponsiveGroupBySelector>) {
    const { fontSize } = model.useState();
    const styles = useStyles2(getStyles);
    const { containerRef, availableWidth } = useResizeObserver();
    const measureText = useTextMeasurement(fontSize);

    const groupByVariable = model.getGroupByVariable();
    const { options, value } = groupByVariable.useState();
    const currentFilters = model.getCurrentFilters();

    // Convert options to string array and get current selection
    const allLabels = useMemo(() => {
      const startTime = performance.now();
      const result = options.map(opt => opt.value as string);
      const endTime = performance.now();
      if (endTime - startTime > 5) {
        logger.warn('ResponsiveGroupBySelector: allLabels calculation took', endTime - startTime, 'ms');
      }
      return result;
    }, [options]);
    
    const selectedLabel = useMemo(() => {
      return value === ALL_VARIABLE_VALUE ? null : (value as string);
    }, [value]);

    // Filter labels based on current state
    const filteredLabels = useLabelFiltering(allLabels, currentFilters, selectedLabel);
    
    // Prioritize labels and calculate visibility with performance monitoring
    const prioritizationResult = useMemo(() => {
      const startTime = performance.now();
      const result = prioritizeLabels(filteredLabels);
      const endTime = performance.now();
      if (endTime - startTime > 5) {
        logger.warn('ResponsiveGroupBySelector: prioritizeLabels took', endTime - startTime, 'ms');
      }
      return result;
    }, [filteredLabels]);

    const { commonLabels, otherLabels } = prioritizationResult;
    
    const visibilityResult = useMemo(() => {
      const startTime = performance.now();
      const result = calculateVisibleRadioOptions(commonLabels, availableWidth, measureText);
      const endTime = performance.now();
      if (endTime - startTime > 10) {
        logger.warn('ResponsiveGroupBySelector: calculateVisibleRadioOptions took', endTime - startTime, 'ms');
      }
      return result;
    }, [commonLabels, availableWidth, measureText]);

    const { visibleLabels, hiddenLabels } = visibilityResult;

    // Prepare dropdown options
    const dropdownOptions = useMemo(() => {
      return [...hiddenLabels, ...otherLabels].map(label => ({
        label,
        value: label,
      }));
    }, [hiddenLabels, otherLabels]);

    // Memoized event handlers
    const handleRadioChange = useCallback((value: string) => {
      model.onRadioChange(value);
    }, [model]);

    const handleSelectAll = useCallback(() => {
      model.onSelectAll();
    }, [model]);

    return (
      <Field label="Group by">
        <div ref={containerRef} className={styles.container}>
          {/* Radio Buttons for Common/Visible Labels */}
          {visibleLabels.length > 0 && (
            <RadioButtonGroup
              size="sm"
              options={visibleLabels.map(label => ({ label, value: label }))}
              value={selectedLabel && visibleLabels.includes(selectedLabel) ? selectedLabel : undefined}
              onChange={handleRadioChange}
              className={styles.radioGroup}
            />
          )}

          {/* Placeholder for dropdown - will be enhanced in future iterations */}
          {dropdownOptions.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              className={styles.dropdown}
            >
              Other labels ({dropdownOptions.length})
            </Button>
          )}

          {/* "All Labels" Option */}
          <Button
            variant={selectedLabel === null ? "primary" : "secondary"}
            size="sm"
            onClick={handleSelectAll}
            className={styles.allButton}
          >
            All Labels
          </Button>
        </div>
      </Field>
    );
  });
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      flexWrap: 'wrap',
      minHeight: theme.spacing(4),
    }),
    radioGroup: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flexWrap: 'nowrap',

      // Responsive behavior
      [theme.breakpoints.down('md')]: {
        gap: theme.spacing(0.25),
      },
    }),
    dropdown: css({
      minWidth: theme.spacing(22),
      maxWidth: theme.spacing(30),

      [theme.breakpoints.down('sm')]: {
        minWidth: theme.spacing(16),
      },
    }),
    allButton: css({
      whiteSpace: 'nowrap',
    }),
  };
}
