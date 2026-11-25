import { render, screen } from '@testing-library/react';
import React, { createRef } from 'react';

import { SideBarButton } from '../SideBarButton';

type SideBarButtonProps = React.ComponentProps<typeof SideBarButton>;

function renderButton(props: Partial<SideBarButtonProps> = {}) {
  return render(
    <SideBarButton
      ariaLabel="Test button"
      disabled={false}
      visible={false}
      paneId="sidebar-pane"
      active={false}
      tooltip="Test tooltip"
      onClick={() => {}}
      iconOrText="cog"
      {...props}
    />
  );
}

describe('SideBarButton', () => {
  it('should forward ref to the underlying button element', () => {
    const ref = createRef<HTMLButtonElement>();

    renderButton({ ref });

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('should set aria-expanded to false and omit aria-controls when its pane is closed', () => {
    renderButton({ visible: false });

    const button = screen.getByRole('button', { name: 'Test button' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveAttribute('aria-controls');
  });

  it('should set aria-expanded to true and point aria-controls at the pane when its pane is open', () => {
    renderButton({ visible: true });

    const button = screen.getByRole('button', { name: 'Test button' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'sidebar-pane');
  });

  it('should not expose the active state as expanded', () => {
    renderButton({ visible: false, active: true });

    expect(screen.getByRole('button', { name: 'Test button' })).toHaveAttribute('aria-expanded', 'false');
  });
});
