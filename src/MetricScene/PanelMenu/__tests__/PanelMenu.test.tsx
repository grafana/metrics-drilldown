import { isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { type PanelMenuItem } from '@grafana/data';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { act } from '@testing-library/react';
import { of, Subject } from 'rxjs';

import { getPanelData } from '../../../shared/GmdVizPanel/components/addToDashboard/addToDashboard';
import { EventOpenAddToDashboard } from '../../../shared/GmdVizPanel/components/addToDashboard/EventOpenAddToDashboard';
import { EventOpenCreateAlert } from '../../../shared/GmdVizPanel/components/createAlert/EventOpenCreateAlert';
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
  openAssistant: jest.fn(),
  createAssistantContextItem: jest.fn((type: string, data: unknown) => ({ type, data })),
}));

// Only sceneGraph.getAncestor is replaced; the action handlers under test (AddToDashboardAction,
// CreateAlertAction, OpenAssistantAction) call it directly with no try/catch, and the real
// implementation throws when no matching ancestor exists (there's no real VizPanel parent in
// these tests). Everything else from @grafana/scenes (SceneObjectBase, VizPanelMenu, VizPanel, ...)
// stays real.
jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    ...jest.requireActual('@grafana/scenes').sceneGraph,
    getAncestor: jest.fn(),
  },
}));

// getPanelData does its own real scene-graph/query-runner traversal (see addToDashboard.test.ts
// for its own coverage); mocked here so these action tests can focus on what each action does
// with the payload, not re-derive it from a real VizPanel.
jest.mock('../../../shared/GmdVizPanel/components/addToDashboard/addToDashboard', () => ({
  getPanelData: jest.fn(),
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
const mockOpenAssistant = openAssistant as jest.Mock;
const mockGetTrailFor = getTrailFor as jest.Mock;
const mockReportExploreMetrics = reportExploreMetrics as jest.Mock;
const mockGetAncestor = sceneGraph.getAncestor as jest.Mock;
const mockGetPanelData = getPanelData as jest.Mock;

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
    getMetadataForMetric: jest.fn().mockResolvedValue(undefined),
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

  it('updates an already-open menu once isAssistantAvailable emits true', () => {
    // Uses a controllable Subject and asserts against the same menu instance throughout, rather
    // than constructing a second PanelMenu with a different canned value: this would still pass
    // if the subscription callback never rebuilt an already-open menu's items.
    const availability$ = new Subject<boolean>();
    mockIsAssistantAvailable.mockReturnValue(availability$);

    const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
    mockGetTrailFor.mockReturnValue(trail);

    const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
    activate(menu);

    expect(itemTexts(menu)).not.toContain('Explain in Assistant');

    act(() => {
      availability$.next(true);
    });

    expect(itemTexts(menu)).toContain('Explain in Assistant');
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

  describe('add to dashboard', () => {
    it('publishes EventOpenAddToDashboard with the panel data on click', () => {
      const fakeVizPanel = { state: { title: 'go_goroutines' } };
      const fakePanelData = { panel: { type: 'timeseries', title: 'go_goroutines', targets: [] }, range: {} };
      mockGetAncestor.mockReturnValue(fakeVizPanel);
      mockGetPanelData.mockReturnValue(fakePanelData);

      const trail = createMockTrail({ isAddToDashboardAvailable: true, isCreateAlertAvailable: false });
      mockGetTrailFor.mockReturnValue(trail);

      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      activate(menu);

      const handler = jest.fn();
      menu.subscribeToEvent(EventOpenAddToDashboard, handler);

      act(() => {
        findItem(menu, 'Add to dashboard').onClick?.({} as any);
      });

      expect(mockGetAncestor).toHaveBeenCalledWith(menu, VizPanel);
      expect(mockGetPanelData).toHaveBeenCalledWith(fakeVizPanel);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].payload).toEqual({ panelData: fakePanelData });
    });
  });

  describe('create alert', () => {
    it('publishes EventOpenCreateAlert with the panel data and reports the click', () => {
      const fakeVizPanel = { state: { title: 'go_goroutines' } };
      const fakePanelData = { panel: { type: 'timeseries', title: 'go_goroutines', targets: [] }, range: {} };
      mockGetAncestor.mockReturnValue(fakeVizPanel);
      mockGetPanelData.mockReturnValue(fakePanelData);

      const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: true });
      mockGetTrailFor.mockReturnValue(trail);

      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      activate(menu);

      const handler = jest.fn();
      menu.subscribeToEvent(EventOpenCreateAlert, handler);

      act(() => {
        findItem(menu, 'Create alert').onClick?.({} as any);
      });

      expect(mockGetAncestor).toHaveBeenCalledWith(menu, VizPanel);
      expect(mockGetPanelData).toHaveBeenCalledWith(fakeVizPanel);
      expect(mockReportExploreMetrics).toHaveBeenCalledWith('create_alert_clicked', { metric: 'go_goroutines' });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].payload).toEqual({ panelData: fakePanelData });
    });
  });

  describe('explain in assistant', () => {
    it('opens the assistant with a prompt built from the panel data', async () => {
      const fakeVizPanel = {};
      const fakePanelData = {
        panel: {
          title: 'go_goroutines',
          targets: [{ expr: 'rate(go_goroutines[5m])' }],
          datasource: { uid: 'prom-uid' },
        },
        range: {},
      };
      mockGetAncestor.mockReturnValue(fakeVizPanel);
      mockGetPanelData.mockReturnValue(fakePanelData);
      mockIsAssistantAvailable.mockReturnValue(of(true));

      const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
      mockGetTrailFor.mockReturnValue(trail);

      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      activate(menu);

      await act(async () => {
        await findItem(menu, 'Explain in Assistant').onClick?.({} as any);
      });

      expect(mockOpenAssistant).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: 'grafana-metricsdrilldown-app/metric-panel',
          prompt: expect.stringContaining('go_goroutines'),
        })
      );
    });
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
