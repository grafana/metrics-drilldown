import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import type { GrafanaTheme2, AdHocFilter } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  type QueryVariable,
  type SceneComponentProps,
} from '@grafana/scenes';
import { Button, Field, RadioButtonGroup, Select, useStyles2 } from '@grafana/ui';

import { reportExploreMetrics } from '../../../interactions';
import { ALL_VARIABLE_VALUE } from '../../../services/variables';
import { VAR_FILTERS, VAR_GROUP_BY } from '../../../shared';
import { isAdHocFiltersVariable, isQueryVariable } from '../../../utils/utils.variables';
import { useResizeObserver } from './hooks/useResizeObserver';
import { useTextMeasurement } from './hooks/useTextMeasurement';
import { useLabelFiltering } from './hooks/useLabelFiltering';
import type { ResponsiveGroupBySelectorState } from './types';
import { DEFAULT_FONT_SIZE } from './utils/constants';
import { prioritizeLabels } from './utils/labelPriority';
import { calculateVisibleRadioOptions } from './utils/widthCalculations';

export class ResponsiveGroupBySelector extends SceneObjectBase<ResponsiveGroupBySelectorState> {
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
    const groupByVariable = sceneGraph.lookupVariable(VAR_GROUP_BY, this)!;
    if (!isQueryVariable(groupByVariable)) {
      throw new Error('Group by variable not found');
    }
    return groupByVariable;
  }

  private getCurrentFilters(): AdHocFilter[] {
    const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (isAdHocFiltersVariable(filtersVariable)) {
      return filtersVariable.state.filters;
    }
    return [];
  }

  public onRadioChange = (value: string) => {
    reportExploreMetrics('breakdown_radio_selected', {
      label: value,
      availableWidth: this.state.availableWidth,
      totalOptions: this.state.allLabels.length,
    });

    const groupByVariable = this.getGroupByVariable();
    groupByVariable.changeValueTo(value);
  };

  public onDropdownChange = (selected: { value: string } | null) => {
    const value = selected?.value ?? ALL_VARIABLE_VALUE;

    reportExploreMetrics('breakdown_dropdown_selected', {
      label: value,
      availableWidth: this.state.availableWidth,
      totalOptions: this.state.allLabels.length,
    });

    const groupByVariable = this.getGroupByVariable();
    groupByVariable.changeValueTo(value);
  };

  public onSelectAll = () => {
    reportExploreMetrics('breakdown_all_selected', {
      availableWidth: this.state.availableWidth,
      totalOptions: this.state.allLabels.length,
    });

    const groupByVariable = this.getGroupByVariable();
    groupByVariable.changeValueTo(ALL_VARIABLE_VALUE);
  };

  public static readonly Component = ({ model }: SceneComponentProps<ResponsiveGroupBySelector>) => {
    const { fontSize } = model.useState();
    const styles = useStyles2(getStyles);
    const { containerRef, availableWidth } = useResizeObserver();
    const measureText = useTextMeasurement(fontSize);

    const groupByVariable = model.getGroupByVariable();
    const { options, value } = groupByVariable.useState();
    const currentFilters = model.getCurrentFilters();

    // Convert options to string array and get current selection
    const allLabels = useMemo(() => options.map(opt => opt.value as string), [options]);
    const selectedLabel = value === ALL_VARIABLE_VALUE ? null : (value as string);

    // Filter labels based on current state
    const filteredLabels = useLabelFiltering(allLabels, currentFilters, selectedLabel);

    // Prioritize labels and calculate visibility
    const { commonLabels, otherLabels } = prioritizeLabels(filteredLabels);
    const { visibleLabels, hiddenLabels } = calculateVisibleRadioOptions(
      commonLabels,
      availableWidth,
      measureText
    );

    // Prepare dropdown options
    const dropdownOptions = useMemo(() => {
      return [...hiddenLabels, ...otherLabels].map(label => ({
        label,
        value: label,
      }));
    }, [hiddenLabels, otherLabels]);

    // Determine if selected label is in dropdown
    const isSelectedInDropdown = selectedLabel && !visibleLabels.includes(selectedLabel);

    return (
      <Field label="Group by">
        <div ref={containerRef} className={styles.container}>
          {/* Radio Buttons for Common/Visible Labels */}
          {visibleLabels.length > 0 && (
            <RadioButtonGroup
              size="sm"
              options={visibleLabels.map(label => ({ label, value: label }))}
              value={selectedLabel && visibleLabels.includes(selectedLabel) ? selectedLabel : undefined}
              onChange={model.onRadioChange}
              className={styles.radioGroup}
            />
          )}

          {/* Dropdown for Other/Hidden Labels */}
          {dropdownOptions.length > 0 && (
            <Select
              value={isSelectedInDropdown ? selectedLabel : null}
              placeholder="Other labels"
              options={dropdownOptions}
              onChange={model.onDropdownChange}
              className={styles.dropdown}
              isClearable
              virtualized
              maxMenuHeight={300}
            />
          )}

          {/* "All Labels" Option */}
          <Button
            variant={selectedLabel === null ? "primary" : "secondary"}
            size="sm"
            onClick={model.onSelectAll}
            className={styles.allButton}
          >
            All Labels
          </Button>
        </div>
      </Field>
    );
  };
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
