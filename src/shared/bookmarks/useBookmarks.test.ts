import { sceneGraph } from '@grafana/scenes';
import { act, renderHook } from '@testing-library/react';

import { DataTrail } from 'AppDataTrail/DataTrail';
import { MetricsDrilldownDataSourceVariable } from 'AppDataTrail/MetricsDrilldownDataSourceVariable';
import { MetricSelectedEvent, VAR_DATASOURCE } from 'shared/shared';

import { genBookmarkKey } from './genBookmarkKey';
import { useBookmarks, type BookmarkFromStorage } from './useBookmarks';
import { PREF_KEYS } from '../user-preferences/pref-keys';
import { userStorage } from '../user-preferences/userStorage';

const storedBookmarks: BookmarkFromStorage[] = [
  { urlValues: { metric: 'http_requests_total', 'var-ds': 'prom' }, createdAt: 1 },
  { urlValues: { metric: 'go_goroutines', 'var-ds': 'other' }, createdAt: 2 },
];

describe('useBookmarks', () => {
  beforeEach(() => {
    userStorage.clear();
    userStorage.setItem(PREF_KEYS.BOOKMARKS, storedBookmarks);
  });

  afterEach(() => {
    userStorage.clear();
  });

  it('loads stored bookmarks immediately and filters them as the datasource changes', () => {
    const trail = new DataTrail({ initialDS: 'prom' });
    const firstRender = jest.fn();
    const { result } = renderHook(() => {
      const bookmarks = useBookmarks(trail);
      firstRender(bookmarks.bookmarks);
      return bookmarks;
    });

    expect(firstRender.mock.calls[0][0]).toEqual([
      { ...storedBookmarks[0], key: genBookmarkKey(storedBookmarks[0].urlValues) },
    ]);

    const datasource = sceneGraph.findByKeyAndType(trail, VAR_DATASOURCE, MetricsDrilldownDataSourceVariable);
    act(() => datasource.setState({ value: 'other' }));
    expect(result.current.bookmarks).toEqual([
      { ...storedBookmarks[1], key: genBookmarkKey(storedBookmarks[1].urlValues) },
    ]);
  });

  it('removes a bookmark without mutating the previous render and preserves other datasources', () => {
    const trail = new DataTrail({ initialDS: 'prom' });
    const publishEvent = jest.spyOn(trail, 'publishEvent');
    const { result } = renderHook(() => useBookmarks(trail));
    const previous = result.current;
    const key = previous.bookmarks[0].key;

    act(() => result.current.removeBookmark(key));

    expect(result.current.bookmarks).toEqual([]);
    expect(userStorage.getItem(PREF_KEYS.BOOKMARKS)).toEqual([storedBookmarks[1]]);

    // A callback from the previous render must still see its original state snapshot.
    previous.gotoBookmark(key);
    expect(publishEvent).toHaveBeenCalledWith(
      new MetricSelectedEvent({ metric: 'http_requests_total', urlValues: storedBookmarks[0].urlValues }),
      true
    );
  });
});
