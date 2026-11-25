import { render, screen } from '@testing-library/react';
import React, { act } from 'react';

import { BookmarksList } from '../sections/BookmarksList/BookmarksList';
import { SideBar } from '../SideBar';

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    ...jest.requireActual('@grafana/scenes').sceneGraph,
    findByKeyAndType: () => ({
      useState: () => ({ value: '' }),
    }),
  },
}));

// @ts-expect-error - overriding readonly static for test stub
BookmarksList.Component = function BookmarksListStub() {
  return null;
};

function createSideBar() {
  return new SideBar({
    sections: [
      new BookmarksList({ key: 'section-a', title: 'Section A', description: 'First test section', icon: 'cog' }),
      new BookmarksList({ key: 'section-b', title: 'Section B', description: 'Second test section', icon: 'star' }),
    ],
  });
}

describe('SideBar disclosure state (WCAG 4.1.2)', () => {
  it('should mark every button as collapsed when no pane is open', () => {
    render(<SideBar.Component model={createSideBar()} />);

    for (const name of ['section-a', 'section-b']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).not.toHaveAttribute('aria-controls');
    }
  });

  it('should mark only the open section button as expanded and point it at the pane', async () => {
    const sidebar = createSideBar();
    render(<SideBar.Component model={sidebar} />);

    await act(async () => {
      sidebar.setState({
        visibleSection: sidebar.state.sections.find((s) => s.state.key === 'section-a') ?? null,
      });
    });

    const pane = screen.getByTestId('sidebar-content');
    const sectionAButton = screen.getByRole('button', { name: 'section-a' });
    const sectionBButton = screen.getByRole('button', { name: 'section-b' });

    expect(pane.id).not.toBe('');
    expect(sectionAButton).toHaveAttribute('aria-expanded', 'true');
    expect(sectionAButton).toHaveAttribute('aria-controls', pane.id);
    expect(sectionBButton).toHaveAttribute('aria-expanded', 'false');
    expect(sectionBButton).not.toHaveAttribute('aria-controls');
  });
});
