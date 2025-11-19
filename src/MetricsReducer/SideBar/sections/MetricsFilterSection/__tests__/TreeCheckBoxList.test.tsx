import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { HIERARCHICAL_SEPARATOR } from 'MetricsReducer/metrics-variables/computeMetricPrefixSecondLevel';

import { TreeCheckBoxList } from '../TreeCheckBoxList';

const createGroup = (label: string, value: string, count: number) => ({ label, value, count });

function setup(overrides = {}) {
  const defaultProps = {
    groups: [
      createGroup('grafana', 'grafana', 10),
      createGroup('node', 'node', 5),
      createGroup('prometheus', 'prometheus', 3),
    ],
    selectedGroups: [],
    expandedPrefixes: new Set<string>(),
    computedSublevels: new Map(),
    onSelectionChange: jest.fn(),
    onExpandToggle: jest.fn(),
    ...overrides,
  };

  return {
    ...defaultProps,
  };
}

describe('TreeCheckBoxList', () => {
  it('renders parent prefixes with expand buttons', () => {
    const props = setup();
    render(<TreeCheckBoxList {...props} />);

    expect(screen.getByText('grafana')).toBeInTheDocument();
    expect(screen.getByText('node')).toBeInTheDocument();
    expect(screen.getByText('prometheus')).toBeInTheDocument();

    expect(screen.getByTestId('expand-grafana')).toBeInTheDocument();
    expect(screen.getByTestId('expand-node')).toBeInTheDocument();
    expect(screen.getByTestId('expand-prometheus')).toBeInTheDocument();
  });

  it('renders parent counts correctly', () => {
    const props = setup();
    render(<TreeCheckBoxList {...props} />);

    expect(screen.getByText('(10)')).toBeInTheDocument();
    expect(screen.getByText('(5)')).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  it('calls onExpandToggle when expand button is clicked', () => {
    const props = setup();
    render(<TreeCheckBoxList {...props} />);

    fireEvent.click(screen.getByTestId('expand-grafana'));

    expect(props.onExpandToggle).toHaveBeenCalledWith('grafana');
    expect(props.onExpandToggle).toHaveBeenCalledTimes(1);
  });

  it('shows children when parent is expanded', () => {
    const computedSublevels = new Map([
      [
        'grafana',
        [
          createGroup('alert', `grafana${HIERARCHICAL_SEPARATOR}alert`, 7),
          createGroup('api', `grafana${HIERARCHICAL_SEPARATOR}api`, 4),
        ],
      ],
    ]);

    const props = setup({
      expandedPrefixes: new Set(['grafana']),
      computedSublevels,
    });

    render(<TreeCheckBoxList {...props} />);

    expect(screen.getByText('alert')).toBeInTheDocument();
    expect(screen.getByText('api')).toBeInTheDocument();
    expect(screen.getByText('(7)')).toBeInTheDocument();
    expect(screen.getByText('(4)')).toBeInTheDocument();
  });

  it('does not show children when parent is not expanded', () => {
    const computedSublevels = new Map([
      [
        'grafana',
        [
          createGroup('alert', `grafana${HIERARCHICAL_SEPARATOR}alert`, 5),
          createGroup('api', `grafana${HIERARCHICAL_SEPARATOR}api`, 3),
        ],
      ],
    ]);

    const props = setup({
      expandedPrefixes: new Set(),
      computedSublevels,
    });

    render(<TreeCheckBoxList {...props} />);

    expect(screen.queryByText('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('api')).not.toBeInTheDocument();
  });

  it('calls onSelectionChange when parent checkbox is clicked', () => {
    const props = setup();
    render(<TreeCheckBoxList {...props} />);

    const checkbox = screen.getByLabelText('grafana');
    fireEvent.click(checkbox);

    expect(props.onSelectionChange).toHaveBeenCalledWith([{ label: 'grafana', value: 'grafana' }]);
  });

  it('calls onSelectionChange when child checkbox is clicked', () => {
    const computedSublevels = new Map([
      [
        'grafana',
        [
          createGroup('alert', `grafana${HIERARCHICAL_SEPARATOR}alert`, 5),
          createGroup('api', `grafana${HIERARCHICAL_SEPARATOR}api`, 3),
        ],
      ],
    ]);

    const props = setup({
      expandedPrefixes: new Set(['grafana']),
      computedSublevels,
    });

    render(<TreeCheckBoxList {...props} />);

    const checkbox = screen.getByLabelText('alert');
    fireEvent.click(checkbox);

    expect(props.onSelectionChange).toHaveBeenCalledWith([
      { label: 'grafana > alert', value: `grafana${HIERARCHICAL_SEPARATOR}alert` },
    ]);
  });

  it('removes children when parent is selected', () => {
    const computedSublevels = new Map([
      [
        'grafana',
        [
          createGroup('alert', `grafana${HIERARCHICAL_SEPARATOR}alert`, 5),
          createGroup('api', `grafana${HIERARCHICAL_SEPARATOR}api`, 3),
        ],
      ],
    ]);

    const props = setup({
      selectedGroups: [
        { label: 'grafana > alert', value: `grafana${HIERARCHICAL_SEPARATOR}alert` },
        { label: 'grafana > api', value: `grafana${HIERARCHICAL_SEPARATOR}api` },
      ],
      expandedPrefixes: new Set(['grafana']),
      computedSublevels,
    });

    render(<TreeCheckBoxList {...props} />);

    const parentCheckbox = screen.getByLabelText('grafana');
    fireEvent.click(parentCheckbox);

    expect(props.onSelectionChange).toHaveBeenCalledWith([{ label: 'grafana', value: 'grafana' }]);
  });

  it('removes parent when child is selected', () => {
    const computedSublevels = new Map([
      [
        'grafana',
        [
          createGroup('alert', `grafana${HIERARCHICAL_SEPARATOR}alert`, 5),
          createGroup('api', `grafana${HIERARCHICAL_SEPARATOR}api`, 3),
        ],
      ],
    ]);

    const props = setup({
      selectedGroups: [{ label: 'grafana', value: 'grafana' }],
      expandedPrefixes: new Set(['grafana']),
      computedSublevels,
    });

    render(<TreeCheckBoxList {...props} />);

    const childCheckbox = screen.getByLabelText('alert');
    fireEvent.click(childCheckbox);

    expect(props.onSelectionChange).toHaveBeenCalledWith([
      { label: 'grafana > alert', value: `grafana${HIERARCHICAL_SEPARATOR}alert` },
    ]);
  });

  it('clicking parent when children are selected replaces children with parent', () => {
    const computedSublevels = new Map([
      [
        'grafana',
        [
          createGroup('alert', `grafana${HIERARCHICAL_SEPARATOR}alert`, 5),
          createGroup('api', `grafana${HIERARCHICAL_SEPARATOR}api`, 3),
        ],
      ],
    ]);

    const props = setup({
      selectedGroups: [{ label: 'grafana > alert', value: `grafana${HIERARCHICAL_SEPARATOR}alert` }],
      expandedPrefixes: new Set(['grafana']),
      computedSublevels,
    });

    render(<TreeCheckBoxList {...props} />);

    const parentCheckbox = screen.getByLabelText('grafana');
    fireEvent.click(parentCheckbox);

    // Should replace child with parent
    expect(props.onSelectionChange).toHaveBeenCalledWith([{ label: 'grafana', value: 'grafana' }]);
  });

  it('unchecks parent when clicked while checked', () => {
    const props = setup({
      selectedGroups: [{ label: 'grafana', value: 'grafana' }],
    });

    render(<TreeCheckBoxList {...props} />);

    const checkbox = screen.getByLabelText('grafana');
    fireEvent.click(checkbox);

    expect(props.onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('unselecting the last child selects the parent', () => {
    const computedSublevels = new Map([
      [
        'grafana',
        [
          createGroup('alert', `grafana${HIERARCHICAL_SEPARATOR}alert`, 5),
          createGroup('api', `grafana${HIERARCHICAL_SEPARATOR}api`, 3),
        ],
      ],
    ]);

    const props = setup({
      selectedGroups: [{ label: 'grafana > alert', value: `grafana${HIERARCHICAL_SEPARATOR}alert` }],
      expandedPrefixes: new Set(['grafana']),
      computedSublevels,
    });

    render(<TreeCheckBoxList {...props} />);

    const childCheckbox = screen.getByLabelText('alert');
    fireEvent.click(childCheckbox);

    // Should select parent when unchecking the last child (navigate up the tree)
    expect(props.onSelectionChange).toHaveBeenCalledWith([{ label: 'grafana', value: 'grafana' }]);
  });

  it('unselecting a child when multiple children are selected keeps other children', () => {
    const computedSublevels = new Map([
      [
        'grafana',
        [
          createGroup('alert', `grafana${HIERARCHICAL_SEPARATOR}alert`, 5),
          createGroup('api', `grafana${HIERARCHICAL_SEPARATOR}api`, 3),
        ],
      ],
    ]);

    const props = setup({
      selectedGroups: [
        { label: 'grafana > alert', value: `grafana${HIERARCHICAL_SEPARATOR}alert` },
        { label: 'grafana > api', value: `grafana${HIERARCHICAL_SEPARATOR}api` },
      ],
      expandedPrefixes: new Set(['grafana']),
      computedSublevels,
    });

    render(<TreeCheckBoxList {...props} />);

    const alertCheckbox = screen.getByLabelText('alert');
    fireEvent.click(alertCheckbox);

    // Should only remove the unchecked child, keep the other child
    expect(props.onSelectionChange).toHaveBeenCalledWith([
      { label: 'grafana > api', value: `grafana${HIERARCHICAL_SEPARATOR}api` },
    ]);
  });

  it('handles empty groups array', () => {
    const props = setup({ groups: [] });
    render(<TreeCheckBoxList {...props} />);

    expect(screen.getByText('No results.')).toBeInTheDocument();
  });

  it('displays selected count correctly', () => {
    const props = setup({
      selectedGroups: [
        { label: 'grafana', value: 'grafana' },
        { label: 'node', value: 'node' },
      ],
    });

    render(<TreeCheckBoxList {...props} />);

    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('clears all selections when clear button is clicked', () => {
    const props = setup({
      selectedGroups: [
        { label: 'grafana', value: 'grafana' },
        { label: 'node', value: 'node' },
      ],
    });

    render(<TreeCheckBoxList {...props} />);

    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);

    expect(props.onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('disables clear button when no selections', () => {
    const props = setup({ selectedGroups: [] });
    render(<TreeCheckBoxList {...props} />);

    const clearButton = screen.getByRole('button', { name: /clear/i });
    expect(clearButton).toBeDisabled();
  });
});

