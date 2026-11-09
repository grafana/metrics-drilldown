import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';

import { GroupBySelector } from './GroupBySelector';

describe('GroupBySelector stable selectors', () => {
  beforeEach(() => {
    jest.spyOn(global, 'IntersectionObserver').mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: () => [],
      root: null,
      rootMargin: '',
      scrollMargin: '',
      thresholds: [],
    }));
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      measureText: () => ({ width: 40 }),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => jest.restoreAllMocks());
  it('keeps the radio group selector usable for label selection', () => {
    const onChange = jest.fn();
    render(<GroupBySelector options={[{ label: 'job', value: 'job' }]} value="$__all" onChange={onChange} />);

    const group = screen.getByTestId('group-by-selector-radio-group');
    fireEvent.click(within(group).getByRole('radio', { name: 'job' }));
    expect(onChange).toHaveBeenCalledWith('job');
  });

  it('keeps the combobox selector usable for label selection in larger sets', () => {
    const onChange = jest.fn();
    render(
      <GroupBySelector
        options={['job', 'instance', 'namespace', 'pod'].map((value) => ({ label: value, value }))}
        value="$__all"
        onChange={onChange}
      />
    );

    const input = screen.getByTestId('group-by-selector-combobox');
    expect(input).toBe(screen.getByRole('combobox'));
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('job');
  });
});
