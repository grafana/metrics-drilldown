import { config } from '@grafana/runtime';
import { sceneGraph, sceneUtils } from '@grafana/scenes';
import { act, renderHook } from '@testing-library/react';

import { getPersonalSignals } from 'MetricsReducer/list-controls/JevSort/personalization';
import { PREF_KEYS } from 'shared/user-preferences/pref-keys';
import { userStorage } from 'shared/user-preferences/userStorage';
import { getTrailFor } from 'shared/utils/utils';

import { useBookmarks } from './useBookmarks';

jest.mock('shared/utils/utils', () => ({
  getTrailFor: jest.fn(),
  getObjectValues: Object.values,
  getObjectKeys: Object.keys,
  embeddedTrailNamespace: 'gmd',
}));
jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    sceneGraph: { ...actual.sceneGraph, findByKeyAndType: jest.fn() },
    sceneUtils: { ...actual.sceneUtils, getUrlState: jest.fn() },
  };
});

const originalUser = config.bootData.user;
beforeEach(() => {
  localStorage.clear();
  config.bootData.user = { ...originalUser, isSignedIn: true, id: 7, orgId: 3 };
  jest.mocked(getTrailFor).mockReturnValue({ publishEvent: jest.fn() } as never);
  jest.mocked(sceneGraph.findByKeyAndType).mockReturnValue({ useState: () => ({ value: 'prom' }) } as never);
  jest
    .mocked(sceneUtils.getUrlState)
    .mockReturnValue({ metric: 'metric_a', 'var-ds': 'prom', 'var-filters': ['private=value'] });
});
afterEach(() => {
  config.bootData.user = originalUser;
  localStorage.clear();
});

it('keeps the ordinary bookmark UI working when the experiment is disabled', () => {
  const { result } = renderHook(() => useBookmarks({} as never));
  act(() => result.current.addBookmark());
  expect(result.current.bookmarks).toHaveLength(1);
  expect(result.current.bookmarks[0].urlValues['var-filters']).toEqual(['private=value']);
  expect(getPersonalSignals('prom').bookmarks).toEqual([]);
  act(() => result.current.removeBookmark(result.current.bookmarks[0].key));
  expect(result.current.bookmarks).toHaveLength(0);
});

it('records new bookmarks for the right datasource and removes their personal boost on deletion', () => {
  localStorage.setItem('gmd.jev.enabled', '1');
  const { result } = renderHook(() => useBookmarks({} as never));
  act(() => result.current.addBookmark());
  expect(getPersonalSignals('prom').bookmarks).toEqual(['metric_a']);
  expect(getPersonalSignals('other').bookmarks).toEqual([]);
  act(() => result.current.removeBookmark(result.current.bookmarks[0].key));
  expect(getPersonalSignals('prom').bookmarks).toEqual([]);
  expect(userStorage.getItem(PREF_KEYS.BOOKMARKS)).toEqual([]);
});

it('displays existing bookmarks without attributing them to the current user/org for ranking', () => {
  localStorage.setItem('gmd.jev.enabled', '1');
  userStorage.setItem(PREF_KEYS.BOOKMARKS, [
    { createdAt: Date.now(), urlValues: { metric: 'legacy_metric', 'var-ds': 'prom' } },
    { createdAt: Date.now(), urlValues: { metric: 'other_metric', 'var-ds': 'other' } },
  ]);
  const { result } = renderHook(() => useBookmarks({} as never));
  expect(result.current.bookmarks.map((bookmark) => bookmark.urlValues.metric)).toEqual(['legacy_metric']);
  expect(getPersonalSignals('prom').bookmarks).toEqual([]);
});
