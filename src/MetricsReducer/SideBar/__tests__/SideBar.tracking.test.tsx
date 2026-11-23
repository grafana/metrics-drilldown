import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { reportExploreMetrics } from 'shared/tracking/interactions';

import { BookmarksList } from '../sections/BookmarksList/BookmarksList';
import { SideBar } from '../SideBar';

jest.mock('shared/tracking/interactions', () => ({ reportExploreMetrics: jest.fn() }));

// The SideBar component reads the current group-by label from a LabelsVariable
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

const mockReportExploreMetrics = reportExploreMetrics as jest.Mock;

function renderSideBar() {
  const sidebar = new SideBar({
    sections: [
      new BookmarksList({ key: 'filters-category', title: 'Category filters', description: 'Category', icon: 'cog' }),
      new BookmarksList({ key: 'filters-prefix', title: 'Prefix filters', description: 'Prefix', icon: 'star' }),
    ],
  });

  render(<SideBar.Component model={sidebar} />);
}

describe('SideBar section tracking', () => {
  beforeEach(() => {
    mockReportExploreMetrics.mockClear();
  });

  it('reports opening the category filter section', () => {
    renderSideBar();

    fireEvent.click(screen.getByRole('button', { name: 'Category filters' }));

    expect(mockReportExploreMetrics).toHaveBeenCalledWith('metrics_sidebar_toggled', {
      action: 'opened',
      section: 'filters-category',
    });
    expect(mockReportExploreMetrics).toHaveBeenCalledWith('sidebar_category_filter_section_clicked', {});
  });

  it('does not report the category event when another section opens', () => {
    renderSideBar();

    fireEvent.click(screen.getByRole('button', { name: 'Prefix filters' }));

    expect(mockReportExploreMetrics).toHaveBeenCalledWith('sidebar_prefix_filter_section_clicked', {});
    expect(mockReportExploreMetrics).not.toHaveBeenCalledWith('sidebar_category_filter_section_clicked', {});
  });

  it('does not report the category event when the category section closes', () => {
    renderSideBar();

    const button = screen.getByRole('button', { name: 'Category filters' });
    fireEvent.click(button);
    mockReportExploreMetrics.mockClear();
    fireEvent.click(button);

    expect(mockReportExploreMetrics).toHaveBeenCalledWith('metrics_sidebar_toggled', {
      action: 'closed',
      section: 'filters-category',
    });
    expect(mockReportExploreMetrics).not.toHaveBeenCalledWith('sidebar_category_filter_section_clicked', {});
  });
});
