import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { CheckBoxList } from '../CheckBoxList';
import { RULE_GROUP_LABELS } from '../rule-group-labels';

const groups = [{ label: RULE_GROUP_LABELS.metrics, value: 'metrics', count: 3 }];

describe('CheckBoxList with a control', () => {
  it('lists the control below the header and counts it as selected', () => {
    render(
      <CheckBoxList
        groups={groups}
        selectedGroups={[{ label: RULE_GROUP_LABELS.metrics, value: 'metrics' }]}
        onSelectionChange={jest.fn()}
        control={{ node: <span>firing control</span>, active: true, clear: jest.fn() }}
      />
    );

    expect(screen.getByText('2 selected')).toBeInTheDocument();
    const items = screen.getByTestId('checkbox-filters-list').querySelectorAll('li');
    expect(items[0]).toHaveTextContent('firing control');
  });

  it('clears both the control and the selected groups', () => {
    const onSelectionChange = jest.fn();
    const clear = jest.fn();
    render(
      <CheckBoxList
        groups={groups}
        selectedGroups={[{ label: RULE_GROUP_LABELS.metrics, value: 'metrics' }]}
        onSelectionChange={onSelectionChange}
        control={{ node: null, active: true, clear }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'clear' }));

    expect(onSelectionChange).toHaveBeenCalledWith([]);
    expect(clear).toHaveBeenCalled();
  });

  it('enables clear when only the control is active', () => {
    const clear = jest.fn();
    render(
      <CheckBoxList
        groups={groups}
        selectedGroups={[]}
        onSelectionChange={jest.fn()}
        control={{ node: null, active: true, clear }}
      />
    );

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'clear' }));
    expect(clear).toHaveBeenCalled();
  });
});
