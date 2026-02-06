import { act, render, screen } from '@testing-library/react';
import React from 'react';

import { Settings } from '../sections/Settings';
import { SideBar } from '../SideBar';

// =============================================================================
// MOCKS
// =============================================================================

/**
 * Mock sceneGraph.findByKeyAndType to return a mock LabelsVariable.
 * The SideBar Component calls this to read the current group-by label value.
 */
jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    ...jest.requireActual('@grafana/scenes').sceneGraph,
    findByKeyAndType: () => ({
      useState: () => ({ value: '' }),
    }),
  },
}));

/**
 * Stub out the Settings section Component so it renders nothing.
 * We only care about the SideBar shell (buttons, close button, focus behavior).
 */
// @ts-expect-error - overriding readonly static for test stub
Settings.Component = () => null;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Creates a SideBar with two minimal sections for testing focus behavior.
 * Uses Settings because it's the simplest section type (no data dependencies).
 */
function createSideBar() {
  return new SideBar({
    sections: [
      new Settings({
        key: 'section-a',
        title: 'Section A',
        description: 'First test section',
        icon: 'cog',
      }),
      new Settings({
        key: 'section-b',
        title: 'Section B',
        description: 'Second test section',
        icon: 'star',
      }),
    ],
  });
}

function renderSideBar(sidebar: SideBar) {
  return render(<SideBar.Component model={sidebar} />);
}

/**
 * Flush all pending requestAnimationFrame callbacks synchronously.
 * The focus management logic uses rAF to wait for the DOM update
 * after the close button is conditionally rendered.
 */
function flushRAF() {
  act(() => {
    jest.runAllTimers();
  });
}

// =============================================================================
// TESTS
// =============================================================================

describe('SideBar focus management (WCAG 2.4.3)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should move focus to close button when a section opens', () => {
    const sidebar = createSideBar();
    renderSideBar(sidebar);

    // Open section A
    act(() => {
      sidebar.setState({
        visibleSection: sidebar.state.sections.find((s) => s.state.key === 'section-a') ?? null,
      });
    });
    flushRAF();

    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toHaveFocus();
  });

  it('should return focus to the triggering button when a section closes', () => {
    const sidebar = createSideBar();
    renderSideBar(sidebar);

    // Open section A
    act(() => {
      sidebar.setState({
        visibleSection: sidebar.state.sections.find((s) => s.state.key === 'section-a') ?? null,
      });
    });
    flushRAF();

    // Close the sidebar
    act(() => {
      sidebar.setState({ visibleSection: null });
    });
    flushRAF();

    const sectionAButton = screen.getByRole('button', { name: 'section-a' });
    expect(sectionAButton).toHaveFocus();
  });

  it('should move focus to close button when switching between sections', () => {
    const sidebar = createSideBar();
    renderSideBar(sidebar);

    // Open section A
    act(() => {
      sidebar.setState({
        visibleSection: sidebar.state.sections.find((s) => s.state.key === 'section-a') ?? null,
      });
    });
    flushRAF();

    // Switch to section B
    act(() => {
      sidebar.setState({
        visibleSection: sidebar.state.sections.find((s) => s.state.key === 'section-b') ?? null,
      });
    });
    flushRAF();

    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toHaveFocus();
  });

  it('should return focus to the last opened section button after switching and closing', () => {
    const sidebar = createSideBar();
    renderSideBar(sidebar);

    // Open section A, then switch to section B
    act(() => {
      sidebar.setState({
        visibleSection: sidebar.state.sections.find((s) => s.state.key === 'section-a') ?? null,
      });
    });
    flushRAF();

    act(() => {
      sidebar.setState({
        visibleSection: sidebar.state.sections.find((s) => s.state.key === 'section-b') ?? null,
      });
    });
    flushRAF();

    // Close the sidebar
    act(() => {
      sidebar.setState({ visibleSection: null });
    });
    flushRAF();

    // Focus should return to section B's button (the last opened section)
    const sectionBButton = screen.getByRole('button', { name: 'section-b' });
    expect(sectionBButton).toHaveFocus();
  });

  it('should not move focus on initial render when no section is open', () => {
    const sidebar = createSideBar();
    renderSideBar(sidebar);
    flushRAF();

    // No button should have focus — the sidebar is closed and nothing triggered focus management
    const sectionAButton = screen.getByRole('button', { name: 'section-a' });
    const sectionBButton = screen.getByRole('button', { name: 'section-b' });
    expect(sectionAButton).not.toHaveFocus();
    expect(sectionBButton).not.toHaveFocus();
  });
});
