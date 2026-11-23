import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { CategoryIcon } from '../CategoryIcon';
import { CheckBoxList } from '../CheckBoxList';

const groups = [
  { label: 'Kubernetes', value: 'kubernetes', count: 3 },
  { label: 'Service', value: 'service', count: 1 },
];

describe('CheckBoxList - icons', () => {
  it('renders the icon returned by renderIcon for each group', () => {
    render(
      <CheckBoxList
        groups={groups}
        selectedGroups={[]}
        onSelectionChange={jest.fn()}
        renderIcon={(value) => <span data-testid={`icon-${value}`} />}
      />
    );

    expect(screen.getByTestId('icon-kubernetes')).toBeInTheDocument();
    expect(screen.getByTestId('icon-service')).toBeInTheDocument();
  });

  it('names each checkbox after its group and selects it from the label', () => {
    const onSelectionChange = jest.fn();

    render(
      <CheckBoxList
        groups={groups}
        selectedGroups={[]}
        onSelectionChange={onSelectionChange}
        renderIcon={(value) => <span data-testid={`icon-${value}`} />}
      />
    );

    fireEvent.click(screen.getByText('Kubernetes'));

    expect(screen.getByRole('checkbox', { name: 'Kubernetes' })).toBeInTheDocument();
    expect(onSelectionChange).toHaveBeenCalledWith([{ label: 'Kubernetes', value: 'kubernetes' }]);
  });

  it('renders no icon without renderIcon', () => {
    const { container } = render(<CheckBoxList groups={groups} selectedGroups={[]} onSelectionChange={jest.fn()} />);

    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('CategoryIcon', () => {
  it('renders the hexagon for the service category', () => {
    const { container } = render(<CategoryIcon categoryId="service" />);

    expect(container.querySelector('svg[viewBox="0 0 16 14"]')).not.toBeNull();
  });

  it('renders a grafana icon for another category', () => {
    const { container } = render(<CategoryIcon categoryId="kubernetes" />);

    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('svg[viewBox="0 0 16 14"]')).toBeNull();
  });
});
