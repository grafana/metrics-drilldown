import { render } from '@testing-library/react';
import React, { createRef } from 'react';

import { SideBarButton } from '../SideBarButton';

describe('SideBarButton', () => {
  it('should forward ref to the underlying button element', () => {
    const ref = createRef<HTMLButtonElement>();

    render(
      <SideBarButton
        ref={ref}
        ariaLabel="Test button"
        disabled={false}
        visible={false}
        active={false}
        tooltip="Test tooltip"
        onClick={() => {}}
        iconOrText="cog"
      />
    );

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
