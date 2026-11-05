import { isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { type PanelMenuItem } from '@grafana/data';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { act } from '@testing-library/react';
import { of, Subject } from 'rxjs';

import { displayWarning } from 'MetricsReducer/helpers/displayStatus';

import { getPanelData } from '../../../shared/GmdVizPanel/components/addToDashboard/addToDashboard';
import { EventOpenAddToDashboard } from '../../../shared/GmdVizPanel/components/addToDashboard/EventOpenAddToDashboard';
import { EventOpenAddToNotebook } from '../../../shared/GmdVizPanel/components/addToNotebook/EventOpenAddToNotebook';
import {
  buildNotebookCapture,
  canAddToNotebook,
} from '../../../shared/GmdVizPanel/components/addToNotebook/notebookCapture';
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

// Only getAncestor is replaced. The action handlers under test call it directly with no
// try/catch, and the real implementation throws when there's no VizPanel ancestor to find.
jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    ...jest.requireActual('@grafana/scenes').sceneGraph,
    getAncestor: jest.fn(),
  },
}));

// getPanelData has its own test coverage (addToDashboard.test.ts); mocked here so these tests
// focus on what each action does with the payload.
jest.mock('../../../shared/GmdVizPanel/components/addToDashboard/addToDashboard', () => ({
  getPanelData: jest.fn(),
}));

jest.mock('../../../shared/GmdVizPanel/components/addToNotebook/notebookCapture', () => ({
  ...jest.requireActual('../../../shared/GmdVizPanel/components/addToNotebook/notebookCapture'),
  buildNotebookCapture: jest.fn(),
  canAddToNotebook: jest.fn(),
}));

jest.mock('MetricsReducer/helpers/displayStatus', () => ({
  ...jest.requireActual('MetricsReducer/helpers/displayStatus'),
  displayWarning: jest.fn(),
}));

// Fixed, input-independent key: these tests only need "does any bookmark exist in storage",
// not a realistic URL state from the duck-typed fake trail.
jest.mock('../../../shared/bookmarks/genBookmarkKey', () => ({
  genBookmarkKey: jest.fn(() => 'fixed-bookmark-key'),
}));

// reportExploreMetrics is already auto-mocked project-wide (jest.config.js moduleNameMapper ->
// src/test/mocks/interactionsMock.ts); no local jest.mock needed.

// Mocks utils.trail directly, not the shared/utils/utils barrel: the barrel re-exports
// getTrailFor from here, and this module's own import chain (via DataTrail, then openFeature)
// leads back to that same barrel, so requireActual-ing the barrel re-enters the cycle mid-
// evaluation and throws a TDZ error. Mocking the leaf module means that chain never executes.
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

function createMockTrail(state: {
  isAddToDashboardAvailable: boolean;
  isCreateAlertAvailable: boolean;
  isAddToNotebookAvailable?: boolean;
}) {
  let subscriber: ((newState: typeof state, prevState: typeof state) => void) | undefined;

  return {
    state,
    // Lets the real, unmocked sceneUtils.getUrlState(trail) walk this fake trail without
    // crashing; with no urlSync, it just returns {}.
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
    menu.activate();

    expect(itemTexts(menu)).toEqual(['Navigation', 'Explore']);
  });

  it('never subscribes to isAssistantAvailable for a non-main panel', () => {
    // Regression test: every PanelMenu used to subscribe regardless of panel type, wasting a
    // rebuild cascade on every emission even though only the main panel reads the result.
    const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
    mockGetTrailFor.mockReturnValue(trail);

    const menu = new PanelMenu({});
    menu.activate();

    expect(mockIsAssistantAvailable).not.toHaveBeenCalled();
  });

  it('adds the Actions group with Copy URL for the main graph panel, even with nothing else available', () => {
    const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
    mockGetTrailFor.mockReturnValue(trail);

    const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
    menu.activate();

    expect(itemTexts(menu)).toEqual(['Navigation', 'Explore', 'Actions', 'Add bookmark', 'Copy URL']);
  });

  it('adds Add to dashboard and Create alert once the trail reports them available', () => {
    const trail = createMockTrail({ isAddToDashboardAvailable: true, isCreateAlertAvailable: true });
    mockGetTrailFor.mockReturnValue(trail);

    const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
    menu.activate();

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
    // A controllable Subject on one menu instance, not a second PanelMenu with a canned value:
    // the latter would still pass even if the subscription never rebuilt an open menu's items.
    const availability$ = new Subject<boolean>();
    mockIsAssistantAvailable.mockReturnValue(availability$);

    const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
    mockGetTrailFor.mockReturnValue(trail);

    const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
    menu.activate();

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
    menu.activate();

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
      menu.activate();

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

  describe('add to notebook', () => {
    it('only appears on the main graph and follows live extension availability', () => {
      const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
      mockGetTrailFor.mockReturnValue(trail);
      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      const rowMenu = new PanelMenu({});
      menu.activate();
      rowMenu.activate();

      expect(itemTexts(menu)).not.toContain('Add to notebook');
      act(() => trail.emitStateChange({ isAddToNotebookAvailable: true }));
      expect(itemTexts(menu)).toContain('Add to notebook');
      expect(itemTexts(rowMenu)).toEqual(['Navigation', 'Explore']);
      act(() => trail.emitStateChange({ isAddToNotebookAvailable: false }));
      expect(itemTexts(menu)).not.toContain('Add to notebook');
    });

    it('captures the panel at click time and publishes the picker event', () => {
      const trail = createMockTrail({
        isAddToDashboardAvailable: false,
        isCreateAlertAvailable: false,
        isAddToNotebookAvailable: true,
      });
      mockGetTrailFor.mockReturnValue(trail);
      jest.mocked(canAddToNotebook).mockReturnValue(true);
      const snapshot = {
        panel: { type: 'timeseries', title: 'requests_total' },
        capturedTimeRange: { from: 'now-1h', to: 'now', timeZone: 'UTC' },
      };
      jest.mocked(buildNotebookCapture).mockReturnValue(snapshot);
      const vizPanel = {};
      mockGetAncestor.mockReturnValue(vizPanel);
      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      menu.activate();
      const handler = jest.fn();
      menu.subscribeToEvent(EventOpenAddToNotebook, handler);
      expect(buildNotebookCapture).not.toHaveBeenCalled();

      act(() => findItem(menu, 'Add to notebook').onClick?.({} as any));

      expect(buildNotebookCapture).toHaveBeenCalledWith(vizPanel);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].payload).toEqual(snapshot);
    });

    it('ignores a stale action after permission is revoked', () => {
      mockGetTrailFor.mockReturnValue(
        createMockTrail({
          isAddToDashboardAvailable: false,
          isCreateAlertAvailable: false,
          isAddToNotebookAvailable: true,
        })
      );
      jest.mocked(canAddToNotebook).mockReturnValue(false);
      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      menu.activate();
      act(() => findItem(menu, 'Add to notebook').onClick?.({} as any));
      expect(buildNotebookCapture).not.toHaveBeenCalled();
    });

    it('warns without opening the picker when a chart cannot be faithfully exported', () => {
      mockGetTrailFor.mockReturnValue(
        createMockTrail({
          isAddToDashboardAvailable: false,
          isCreateAlertAvailable: false,
          isAddToNotebookAvailable: true,
        })
      );
      jest.mocked(canAddToNotebook).mockReturnValue(true);
      jest.mocked(buildNotebookCapture).mockImplementation(() => {
        throw new Error('Unsupported data transformation');
      });
      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      menu.activate();
      const handler = jest.fn();
      menu.subscribeToEvent(EventOpenAddToNotebook, handler);

      act(() => findItem(menu, 'Add to notebook').onClick?.({} as any));

      expect(handler).not.toHaveBeenCalled();
      expect(displayWarning).toHaveBeenCalledWith([expect.stringContaining('no custom data transformations')]);
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
      menu.activate();

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
      menu.activate();

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
      menu.activate();

      expect(itemTexts(menu)).toContain('Add bookmark');
      expect(itemTexts(menu)).not.toContain('Remove bookmark');
    });

    it('shows "Remove bookmark" when the current state is already bookmarked', () => {
      const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
      mockGetTrailFor.mockReturnValue(trail);
      userStorage.setItem(PREF_KEYS.BOOKMARKS, [{ urlValues: {}, createdAt: 1 }]);

      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      menu.activate();

      expect(itemTexts(menu)).toContain('Remove bookmark');
      expect(itemTexts(menu)).not.toContain('Add bookmark');
    });

    it('adds a bookmark, reports the interaction, and flips the label to Remove bookmark', () => {
      const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
      mockGetTrailFor.mockReturnValue(trail);

      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      menu.activate();

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
      menu.activate();

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
      // Regression test: storage changes between build and click, with no rebuild trigger in
      // between. A fix that branches on the value captured at build time would add a duplicate
      // here instead of toggling off.
      const trail = createMockTrail({ isAddToDashboardAvailable: false, isCreateAlertAvailable: false });
      mockGetTrailFor.mockReturnValue(trail);

      const menu = new PanelMenu({ key: TOPVIEW_PANEL_MENU_KEY });
      menu.activate();

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
