import { Combobox, RadioButtonGroup } from '@grafana/ui';
import React, { useMemo } from 'react';

import { noOp } from 'utils';

export type GroupByOptions = Array<{ label: string; value: string }>;

interface GroupBySelectorProps {
  options: GroupByOptions;
  value: string;
  onChange: (label: string, ignore?: boolean) => void;
  loading?: boolean;
}

export const DEFAULT_ALL_OPTION = {
  label: 'All',
  value: '$__all',
};

const MAX_RADIOGROUP_OPTIONS = 4;
const COMBOBOX_PLACEHOLDER = 'Select a label to group by';

export function GroupBySelector(props: Readonly<GroupBySelectorProps>) {
  const { loading, options, value, onChange } = props;
  const processedOptions = useMemo(() => [DEFAULT_ALL_OPTION, ...options], [options]);

  if (loading) {
    // prevent layout changes after loading
    return <Combobox options={[]} placeholder={COMBOBOX_PLACEHOLDER} onChange={noOp} />;
  }

  // as per Grafana Design System guidelines (https://grafana.com/developers/saga/components/radio-button-group/#when-to-use)
  const useRadios = processedOptions.length <= MAX_RADIOGROUP_OPTIONS;

  if (useRadios) {
    return (
      <RadioButtonGroup
        data-testid="group-by-selector-radio-group"
        options={processedOptions}
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <Combobox
      id="group-by-selector"
      options={processedOptions}
      value={value}
      placeholder={COMBOBOX_PLACEHOLDER}
      onChange={(option) => {
        onChange(option ? option.value : DEFAULT_ALL_OPTION.value);
      }}
      isClearable
    />
  );
}
