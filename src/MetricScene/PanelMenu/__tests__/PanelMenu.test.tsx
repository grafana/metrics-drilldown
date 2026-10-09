import { isAssistantAvailable } from '@grafana/assistant';
import { type PanelMenuItem } from '@grafana/data';
import { act } from '@testing-library/react';
import { of } from 'rxjs';

import { reportExploreMetrics } from '../../../shared/tracking/interactions';
import { PREF_KEYS } from '../../../shared/user-preferences/pref-keys';
import { userStorage } from '../../../shared/user-preferences/userStorage';
import { getTrailFor } from '../../../shared/utils/utils';
import { TOPVIEW_PANEL_MENU_KEY } from '../../MetricGraphScene';
import { PanelMenu } from '../PanelMenu';

// =============================================================================
// MOCKS
// =============================================================================

jest.mock('@grafana/assistant', () => ({
  isAssistantAvailable: jest.fn(),
}));

// genBookmarkKey is mocked to a fixed, input-independent value rather than trying to make the
// real sceneUtils.getUrlState(trail) produce a realistic SceneObjectUrlValues from a plain
// duck-typed fake trail. This makes "is the current state bookmarked" collapse to "does any
// bookmark exist in storage", which is all these tests need, without depending on the real
// Scenes URL-sync machinery at all.
jest.mock('../../../shared/bookmarks/genBookmarkKey', () => ({
  genBookmarkKey: jest.fn(() => 'fixed-bookmark-key'),
}));

// reportExploreMetrics is already auto-mocked project-wide via jest.config.js's moduleNameMapper
// (src/test/mocks/interactionsMock.ts); no local jest.mock needed here.

// Mocks utils.trail directly, not the shared/utils/utils barrel: the barrel re-exports
// getTrailFor from here, and utils.trail itself imports DataTrail (which imports openFeature,
// which imports back from the barrel for getObjectKeys) — requireActual-ing the barrel re-enters
// that circular chain mid-evaluation and throws a TDZ error. Mocking this leaf module directly
// means DataTrail's import never executes at all, sidestepping the cycle entirely.
jest.mock('../../../shared/utils/utils.trail', () => ({
  getTrailFor: jest.fn(),
  embeddedTrailNamespace: 'gmd',
  newMetricsTrail: jest.fn(),
  getUrlForTrail: jest.fn(),
  limitAdhocProviders: jest.fn(),
}));

const mockIsAssistantAvailable = isAssistantAvailable as jest.Mock;
const mockGetTrailFor = getTrailFor as jest.Mock;
const mockReportExploreMetrics = reportExploreMetrics as jest.Mock;

// =============================================================================
// HELPERS
// =============================================================================

function createMockTrail(state: { isAddToDashboardAvailable: boolean; isCreateAlertAvailable: boolean }) {
  let subscriber: ((newState: typeof state, prevState: typeof state) => void) | undefined;

  return {
    state,
    // No urlSync and a no-op forEachChild let the real sceneUtils.getUrlState(trail) (called by
    // BookmarkAction, unmocked) walk this fake trail without crashing; it just returns {}.
    forEachChild: jest.fn(),
    subscribeToState: jest.fn((cb: (newState: typeof state, prevState: typeof state) => void) => {
      subscriber = cb;
      return { unsubscribe: jest.fn() };
    }),
    emitStateChange(nextState: Partial<typeof state>) {
      const prevState = { ...this.state };
      this.state = { ...this.state, ...nextState };
      subscriber?.(this.state, prevState);
    },
  };
}

function activate(menu: PanelMenu) {
  menu.activate();
}

function itemTexts(menu: PanelMenu): string[] {
  return (menu.state.body?.state.items ?? []).map((item) => String(item.text));
}

function findItem(menu: PanelMenu, text: string): PanelMenuItem {
  const item = (menu.state.body?.state.items ?? []).find((i) => i.text === text);
  if (!item) {
    throw new Error(`No menu item with text "${text}"`);
  }
  return item;
}

// =============================================================================
// TESTS
// =============================================================================

describe('PanelMenu', () => {
  beforeEach(() => {
    userStorage.clear();
    mockIsAssistantAvailable.mockReturnValue(of(false));
  });

  it('only shows Navigation/Explore for a non-main panel', () => {
    const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
    mockGetTrailFor.mockReturnValue(trail);

    const menu = new PanelMenu({});
    activate(menu);

    expect(itemTexts(menu)).toEqual(['Navigation', 'Explore']);
  });

  it('never subscribes to isAssistantAvailable for a non-main panel', () => {
    // Regression test: every PanelMenu used to subscribe regardless of panel type (one per row
    // in MetricLabelsList/MetricLabelValuesList, for example), even though only the main panel
    // ever reads the result, wasting a subscription and rebuild cascade on every emission.
    const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
    mockGetTrailFor.mockReturnValue(trail);

    const menu = new PanelMenu({});
    activate(menu);

    expect(mockIsAssistantAvailable).not.toHaveBeenCalled();
  });

  it('adds the Actions group with Copy URL for the main graph panel, even with nothing else available', () => {
    const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
    mockGetTrailFor.mockReturnValue(trail);

    const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
    activate(menu);

    expect(itemTexts(menu)).toEqual(['Navigation', 'Explore', 'Actions', 'Add bookmark', 'Copy URL']);
  });

  it('adds Add to dashboard and Create alert once the trail reports them available', () => {
    const trail = createMockTrail({ isAddToDashboardAvailable: true, isCreateAlertAvailable: true });
    mockGetTrailFor.mockReturnValue(trail);

    const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
    activate(menu);

    expect(itemTexts(menu)).toEqual([
      'Navigation',
      'Explore',
      'Actions',
      'Add to dashboard',
      'Create alert',
      'Add bookmark',
      'Copy URL',
    ]);
  });

  it('adds Explain in Assistant once isAssistantAvailable emits true', () => {
    const availability$ = of(false);
    mockIsAssistantAvailable.mockReturnValue(availability$);

    const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
    mockGetTrailFor.mockReturnValue(trail);

    const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
    activate(menu);

    expect(itemTexts(menu)).not.toContain('Explain in Assistant');

    // Re-activate with availability now true, emulating a later emission on the same observable.
    mockIsAssistantAvailable.mockReturnValue(of(true));
    const menu2 = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
    activate(menu2);

    expect(itemTexts(menu2)).toContain('Explain in Assistant');
  });

  it('rebuilds items when the trail availability flags change after activation', () => {
    const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
    mockGetTrailFor.mockReturnValue(trail);

    const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
    activate(menu);

    expect(itemTexts(menu)).not.toContain('Add to dashboard');

    act(() => {
      trail.emitStateChange({ isAddToDashboardAvailable: true });
    });

    expect(itemTexts(menu)).toContain('Add to dashboard');
  });

  describe('bookmark', () => {
    it('shows "Add bookmark" when the current state is not bookmarked', () => {
      const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
      mockGetTrailFor.mockReturnValue(trail);

      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      activate(menu);

      expect(itemTexts(menu)).toContain('Add bookmark');
      expect(itemTexts(menu)).not.toContain('Remove bookmark');
    });

    it('shows "Remove bookmark" when the current state is already bookmarked', () => {
      const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
      mockGetTrailFor.mockReturnValue(trail);
      userStorage.setItem(PREF_KEYS.BOOKMARKS, [{ urlValues: {}, createdAt: 1 }]);

      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      activate(menu);

      expect(itemTexts(menu)).toContain('Remove bookmark');
      expect(itemTexts(menu)).not.toContain('Add bookmark');
    });

    it('adds a bookmark, reports the interaction, and flips the label to Remove bookmark', () => {
      const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
      mockGetTrailFor.mockReturnValue(trail);

      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      activate(menu);

      act(() => {
        findItem(menu, 'Add bookmark').onClick?.({} as any);
      });

      expect(mockReportExploreMetrics).toHaveBeenCalledWith('bookmark_changed', { action: 'toggled_on' });
      expect(itemTexts(menu)).toContain('Remove bookmark');
      expect(itemTexts(menu)).not.toContain('Add bookmark');

      const stored = userStorage.getItem(PREF_KEYS.BOOKMARKS) ?? [];
      expect(stored).toHaveLength(1);
      expect(stored[0].urlValues).toEqual({});
    });

    it('removes an existing bookmark, reports the interaction, and flips the label back to Add bookmark', () => {
      const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
      mockGetTrailFor.mockReturnValue(trail);
      userStorage.setItem(PREF_KEYS.BOOKMARKS, [{ urlValues: {}, createdAt: 1 }]);

      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      activate(menu);

      act(() => {
        findItem(menu, 'Remove bookmark').onClick?.({} as any);
      });

      expect(mockReportExploreMetrics).toHaveBeenCalledWith('bookmark_changed', { action: 'toggled_off' });
      expect(itemTexts(menu)).toContain('Add bookmark');
      expect(itemTexts(menu)).not.toContain('Remove bookmark');

      const stored = userStorage.getItem(PREF_KEYS.BOOKMARKS) ?? [];
      expect(stored).toHaveLength(0);
    });

    it('re-checks the bookmark state at click time rather than trusting the label it was built with', () => {
      // Regression test: the menu is built while nothing is bookmarked (item reads "Add
      // bookmark"), but storage changes before the click, without any of the triggers that
      // rebuild the menu (no activation, no availability change, no URL change). A fix that
      // still branches on the value captured when the item was built would run the "add" path
      // here and create a duplicate; the fix re-checks storage inside onClick instead.
      const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
      mockGetTrailFor.mockReturnValue(trail);

      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      activate(menu);

      const staleItem = findItem(menu, 'Add bookmark');

      userStorage.setItem(PREF_KEYS.BOOKMARKS, [{ urlValues: {}, createdAt: 1 }]);

      act(() => {
        staleItem.onClick?.({} as any);
      });

      expect(mockReportExploreMetrics).toHaveBeenCalledWith('bookmark_changed', { action: 'toggled_off' });

      const stored = userStorage.getItem(PREF_KEYS.BOOKMARKS) ?? [];
      expect(stored).toHaveLength(0);
    });
  });
});
