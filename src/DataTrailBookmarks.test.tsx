import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { DataTrail } from './DataTrail';
import { DataTrailsBookmarks } from './DataTrailBookmarks';
import { getBookmarkKey, getTrailStore, type DataTrailBookmark } from './TrailStore/TrailStore';

jest.mock('./TrailStore/TrailStore');

const onSelect = jest.fn();
const onDelete = jest.fn();

describe('DataTrailsBookmarks', () => {
  const trail = new DataTrail({});
  const bookmark: DataTrailBookmark = { urlValues: { key: '1', metric: '' }, createdAt: Date.now() };

  beforeEach(() => {
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [],
      getTrailForBookmark: jest.fn(),
    }));

    (getBookmarkKey as jest.Mock).mockReturnValue('bookmark-key');
  });

  it('does not render if there are no bookmarks', () => {
    render(<DataTrailsBookmarks onSelect={onSelect} onDelete={onDelete} />);
    expect(screen.queryByText('Or view bookmarks')).not.toBeInTheDocument();
  });

  it('renders the bookmarks header and toggle button', () => {
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [bookmark],
      recent: [],
    }));
    render(<DataTrailsBookmarks onSelect={onSelect} onDelete={onDelete} />);
    expect(screen.getByText('Or view bookmarks')).toBeInTheDocument();
    expect(screen.getByLabelText('bookmarkCarrot')).toBeInTheDocument();
  });

  it('toggles the bookmark list when the toggle button is clicked', () => {
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [bookmark],
      recent: [],
      getTrailForBookmark: jest.fn().mockReturnValue(trail),
    }));
    render(<DataTrailsBookmarks onSelect={onSelect} onDelete={onDelete} />);
    const button = screen.getByLabelText('bookmarkCarrot');
    fireEvent.click(button);
    expect(screen.getByText('All metrics')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByText('All metrics')).not.toBeInTheDocument();
  });

  it('calls onDelete when the delete button is clicked', () => {
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [bookmark],
      recent: [],
      getTrailForBookmark: jest.fn().mockReturnValue(trail),
    }));
    render(<DataTrailsBookmarks onSelect={onSelect} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('bookmarkCarrot'));
    fireEvent.click(screen.getByLabelText('Remove bookmark'));
    expect(onDelete).toHaveBeenCalled();
  });
});
