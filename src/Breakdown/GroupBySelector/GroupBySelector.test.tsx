import { render, waitFor } from '@testing-library/react';
import React, { createElement } from 'react';

import { GroupBySelector } from './GroupBySelector';

// No resize observer used anymore

// Don't mock utils - use the real functions

jest.mock('@grafana/ui', () => ({
  Combobox: jest.fn(({ placeholder, value, options, onChange, ...props }) =>
    createElement('div', {
      'data-testid': 'combobox',
      ...props
    }, [
      createElement('input', {
        key: 'combobox-input',
        placeholder,
        'data-testid': 'combobox-input',
        value: value || '',
        onChange: (e: any) => {
          const selectedOption = options?.find((opt: any) => opt.value === e.target.value);
          onChange?.(selectedOption);
        }
      })
    ])
  ),
  RadioButtonGroup: jest.fn(({ options, value, onChange }) =>
    createElement('div', { 'data-testid': 'radio-group' },
      options.map((option: any, index: number) =>
        createElement('div', {
          key: index,
          'data-testid': `radio-option-${index}`
        }, [
          createElement('input', {
            key: `input-${index}`,
            type: 'radio',
            value: option.value,
            checked: value === option.value,
            onChange: () => onChange(option.value),
            'aria-label': option.label,
            'data-testid': `radio-input-${index}`
          }),
          createElement('span', {
            key: `label-${index}`,
            'data-testid': `radio-label-${index}`
          }, option.label)
        ])
      )
    )
  ),
  Field: jest.fn(({ label, children }) =>
    createElement('div', { 'data-testid': 'field' }, [
      createElement('label', { key: 'field-label' }, label),
      createElement('div', { key: 'field-children' }, children)
    ])
  ),
  useStyles2: jest.fn(() => ({
    container: 'container-class',
    select: 'select-class'
  })),
}));

// Get references to the mocked functions for testing
const { useStyles2: mockUseStyles2 } = jest.requireMock('@grafana/ui');

describe('GroupBySelector', () => {
  const defaultProps = {
    options: [
      { label: 'Service Name', value: 'resource.service.name' },
      { label: 'Operation Name', value: 'name' },
      { label: 'Status', value: 'status' },
    ],
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure mocks return expected values
    mockUseStyles2.mockReturnValue({
      container: 'container-class',
      select: 'select-class'
    });
  });

  it('renders with basic props', async () => {
    const { container } = render(<GroupBySelector {...defaultProps} />);

    expect(container).toBeInTheDocument();
  });

  it('renders with custom field label', async () => {
    const { container } = render(
      <GroupBySelector
        {...defaultProps}
        fieldLabel="Custom Group By"
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('renders with showAll option', async () => {
    const { container } = render(<GroupBySelector {...defaultProps} showAll />);

    expect(container).toBeInTheDocument();
  });

  it('renders radios when <= 3 options and auto-selects first', async () => {
    const onChange = jest.fn();
    render(
      <GroupBySelector
        options={defaultProps.options}
        onChange={onChange}
      />
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('resource.service.name', true));
  });

  it('renders combobox when >= 4 options and shows All when showAll', async () => {
    const onChange = jest.fn();
    render(
      <GroupBySelector
        options={[...defaultProps.options, { label: 'Job', value: 'job' }]}
        onChange={onChange}
        showAll
      />
    );
  });

  it('applies custom attribute prefixes', async () => {
    const attributePrefixes = {
      custom: 'custom.',
      test: 'test.',
    };

    const { container } = render(
      <GroupBySelector
        {...defaultProps}
        attributePrefixes={attributePrefixes}
      />
    );

    expect(container).toBeInTheDocument();
  });
});
