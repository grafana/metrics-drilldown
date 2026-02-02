/**
 * QuickSearch.test.tsx
 *
 * Tests for the QuickSearch component and the `grafana_assistant_quick_search_tab_test` experiment.
 *
 * EXPERIMENT OVERVIEW:
 * This experiment tests whether making the AI assistant button always visible
 * increases user engagement with the Grafana Assistant in Quick Search.
 *
 * VARIANT BEHAVIORS:
 * - Treatment: AI button always visible when assistant is available.
 *              User can Tab to button, press Enter to enter question mode.
 *              The `?` shortcut is DISABLED (treated as normal character).
 *
 * - Control/Excluded: Original behavior. AI button only visible after
 *                     entering question mode. User types `?` as first
 *                     character to enter question mode.
 *
 * ANALYTICS EVENTS:
 * - `quick_search_assistant_mode_entered`: Fired when user enters question mode.
 *   Includes `from` field: 'question_mark' | 'button'
 * - `quick_search_assistant_question_asked`: Fired when user submits a question.
 *   (tested elsewhere, fired by openQuickSearchAssistant)
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { evaluateFeatureFlag } from 'shared/featureFlags/openFeature';
import { reportExploreMetrics } from 'shared/tracking/interactions';

import { CountsProvider } from './CountsProvider/CountsProvider';
import { QuickSearch } from './QuickSearch';
import { openQuickSearchAssistant, useQuickSearchAssistantAvailability } from './QuickSearchAssistant';

// =============================================================================
// MOCKS
// =============================================================================

jest.mock('shared/featureFlags/openFeature', () => ({
  evaluateFeatureFlag: jest.fn(),
}));

jest.mock('shared/tracking/interactions', () => ({
  reportExploreMetrics: jest.fn(),
}));

jest.mock('./QuickSearchAssistant', () => ({
  openQuickSearchAssistant: jest.fn(),
  useQuickSearchAssistantAvailability: jest.fn(),
}));

const mockEvaluateFeatureFlag = evaluateFeatureFlag as jest.Mock;
const mockReportExploreMetrics = reportExploreMetrics as jest.Mock;
const mockUseQuickSearchAssistantAvailability = useQuickSearchAssistantAvailability as jest.Mock;
const mockOpenQuickSearchAssistant = openQuickSearchAssistant as jest.Mock;

/**
 * Mock CountsProvider that renders nothing.
 * The real CountsProvider displays metric counts in the input suffix.
 */
class MockCountsProvider extends CountsProvider {
  static readonly Component = () => null;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Creates a QuickSearch instance with the specified experiment variant.
 * Sets the variant directly to bypass async flag evaluation in tests.
 */
function createQuickSearch(variant: 'treatment' | 'control' | 'excluded' = 'excluded') {
  const countsProvider = new MockCountsProvider({});
  const quickSearch = new QuickSearch({
    urlSearchParamName: 'search',
    targetName: 'metric',
    countsProvider,
    displayCounts: false,
  });
  // Bypass async evaluateFeatureFlag by setting variant directly
  quickSearch.setState({ assistantTabExperimentVariant: variant });
  return quickSearch;
}

/**
 * Renders the QuickSearch component with the given model.
 */
function renderQuickSearch(quickSearch: QuickSearch) {
  return render(<QuickSearch.Component model={quickSearch} />);
}

// =============================================================================
// TESTS
// =============================================================================

describe('QuickSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEvaluateFeatureFlag.mockResolvedValue('excluded');
  });

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  describe('initialization', () => {
    it('should default assistantTabExperimentVariant to "excluded" (safest default)', () => {
      const countsProvider = new MockCountsProvider({});
      const quickSearch = new QuickSearch({
        urlSearchParamName: 'search',
        targetName: 'metric',
        countsProvider,
      });
      // Default to excluded ensures users get control behavior until flag resolves
      expect(quickSearch.state.assistantTabExperimentVariant).toBe('excluded');
    });
  });

  // ---------------------------------------------------------------------------
  // Treatment Variant
  // ---------------------------------------------------------------------------

  describe('treatment variant', () => {
    /**
     * TREATMENT BEHAVIOR:
     * - AI button is ALWAYS visible (when assistant available)
     * - `?` shortcut is DISABLED (treated as normal search character)
     * - User enters question mode by clicking the AI button
     * - Placeholder does NOT mention `?`
     */

    beforeEach(() => {
      mockUseQuickSearchAssistantAvailability.mockReturnValue(true);
    });

    it('should show AI button when assistant is available (always visible in treatment)', () => {
      const quickSearch = createQuickSearch('treatment');
      renderQuickSearch(quickSearch);

      // In treatment, button is visible even when NOT in question mode
      expect(screen.getByRole('button', { name: /ask the grafana assistant/i })).toBeInTheDocument();
    });

    it('should treat ? as normal character (NOT enter question mode)', () => {
      // In treatment, `?` is disabled as a shortcut. This tests that:
      // 1. Typing `?` does NOT enter question mode
      // 2. The `?` character appears in the input (normal typing behavior)
      // 3. No analytics event is fired

      const quickSearch = createQuickSearch('treatment');
      renderQuickSearch(quickSearch);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '?' } });

      expect(quickSearch.state.isQuestionMode).toBe(false);
      expect(quickSearch.state.value).toBe('?'); // ? appears as normal text
      expect(mockReportExploreMetrics).not.toHaveBeenCalledWith(
        'quick_search_assistant_mode_entered',
        expect.anything()
      );
    });

    it('should enter question mode when AI button clicked and emit analytics', () => {
      // This is the primary entry point to question mode in treatment
      const quickSearch = createQuickSearch('treatment');
      renderQuickSearch(quickSearch);

      const aiButton = screen.getByRole('button', { name: /ask the grafana assistant/i });
      fireEvent.click(aiButton);

      expect(quickSearch.state.isQuestionMode).toBe(true);
      // Analytics: track that user entered mode via button click
      expect(mockReportExploreMetrics).toHaveBeenCalledWith('quick_search_assistant_mode_entered', {
        from: 'button',
      });
    });

    it('should show tab+enter hint in placeholder (not ? hint)', () => {
      const quickSearch = createQuickSearch('treatment');
      renderQuickSearch(quickSearch);

      const input = screen.getByRole('textbox');
      // Placeholder should mention tab+enter, not `?`
      expect(input).toHaveAttribute('placeholder', expect.stringContaining('press tab then enter'));
      expect(input).not.toHaveAttribute('placeholder', expect.stringContaining('type ?'));
    });
  });

  // ---------------------------------------------------------------------------
  // Control/Excluded Variant
  // ---------------------------------------------------------------------------

  describe('control/excluded variant', () => {
    /**
     * CONTROL/EXCLUDED BEHAVIOR (original UX):
     * - AI button is only visible AFTER entering question mode
     * - `?` shortcut is ENABLED (typing ? enters question mode)
     * - Placeholder mentions `?` to guide users
     */

    beforeEach(() => {
      mockUseQuickSearchAssistantAvailability.mockReturnValue(true);
    });

    it('should NOT show AI button when not in question mode', () => {
      const quickSearch = createQuickSearch('control');
      renderQuickSearch(quickSearch);

      // In control, button is hidden until user enters question mode
      expect(screen.queryByRole('button', { name: /ask the grafana assistant/i })).not.toBeInTheDocument();
    });

    it('should show AI button when in question mode', () => {
      const quickSearch = createQuickSearch('control');
      quickSearch.setState({ isQuestionMode: true });
      renderQuickSearch(quickSearch);

      // Once in question mode, button appears
      expect(screen.getByRole('button', { name: /ask the grafana assistant/i })).toBeInTheDocument();
    });

    it('should enter question mode when ? is typed as first character and emit analytics', () => {
      // This is the primary entry point to question mode in control
      const quickSearch = createQuickSearch('control');
      renderQuickSearch(quickSearch);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '?' } });

      expect(quickSearch.state.isQuestionMode).toBe(true);
      expect(quickSearch.state.value).toBe(''); // ? is intercepted, not added to value
      // Analytics: track that user entered mode via ? shortcut
      expect(mockReportExploreMetrics).toHaveBeenCalledWith('quick_search_assistant_mode_entered', {
        from: 'question_mark',
      });
    });

    it('should show ? hint in placeholder to guide users', () => {
      const quickSearch = createQuickSearch('control');
      renderQuickSearch(quickSearch);

      const input = screen.getByRole('textbox');
      // Placeholder should mention `?` to teach users the shortcut
      expect(input).toHaveAttribute('placeholder', expect.stringContaining('type ?'));
    });
  });

  // ---------------------------------------------------------------------------
  // Assistant Unavailable
  // ---------------------------------------------------------------------------

  describe('when assistant is unavailable', () => {
    /**
     * When the Grafana Assistant service is not available:
     * - AI button is NEVER shown (regardless of variant)
     * - `?` is treated as a normal character (graceful degradation)
     * - Placeholder does NOT mention assistant
     */

    beforeEach(() => {
      mockUseQuickSearchAssistantAvailability.mockReturnValue(false);
    });

    it('should NOT show AI button in treatment (even though treatment shows button)', () => {
      const quickSearch = createQuickSearch('treatment');
      renderQuickSearch(quickSearch);

      // No button when assistant unavailable, even in treatment
      expect(screen.queryByRole('button', { name: /ask the grafana assistant/i })).not.toBeInTheDocument();
    });

    it('should treat ? as normal character in control (graceful degradation)', () => {
      // When assistant unavailable, ? should not try to enter question mode
      const quickSearch = createQuickSearch('control');
      renderQuickSearch(quickSearch);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '?' } });

      expect(quickSearch.state.isQuestionMode).toBe(false);
      expect(quickSearch.state.value).toBe('?'); // ? typed as normal character
    });

    it('should NOT mention assistant in placeholder', () => {
      const quickSearch = createQuickSearch('control');
      renderQuickSearch(quickSearch);

      const input = screen.getByRole('textbox');
      // Don't confuse users by mentioning unavailable feature
      expect(input).not.toHaveAttribute('placeholder', expect.stringContaining('Grafana Assistant'));
    });
  });

  // ---------------------------------------------------------------------------
  // Question Mode Behavior (shared across variants)
  // ---------------------------------------------------------------------------

  describe('question mode behavior', () => {
    /**
     * Once in question mode, behavior is the same across all variants:
     * - Enter key submits the question to the assistant
     * - Escape key exits question mode and clears input
     * - AI button click with text submits the question
     */

    beforeEach(() => {
      mockUseQuickSearchAssistantAvailability.mockReturnValue(true);
    });

    it('should open assistant when Enter pressed with text in question mode', () => {
      const quickSearch = createQuickSearch('control');
      quickSearch.setState({ isQuestionMode: true, value: 'What metrics are high?' });
      renderQuickSearch(quickSearch);

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should call openQuickSearchAssistant with the question
      expect(mockOpenQuickSearchAssistant).toHaveBeenCalledWith(quickSearch, 'What metrics are high?');
      // Should reset to normal quick search after submitting
      expect(quickSearch.state.isQuestionMode).toBe(false);
      expect(quickSearch.state.value).toBe('');
    });

    it('should NOT open assistant when Enter pressed with empty text', () => {
      const quickSearch = createQuickSearch('control');
      quickSearch.setState({ isQuestionMode: true, value: '' });
      renderQuickSearch(quickSearch);

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter' });

      // Nothing should happen with empty input
      expect(mockOpenQuickSearchAssistant).not.toHaveBeenCalled();
    });

    it('should exit question mode and clear input when Escape pressed', () => {
      const quickSearch = createQuickSearch('control');
      quickSearch.setState({ isQuestionMode: true, value: 'partial question' });
      renderQuickSearch(quickSearch);

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Escape' });

      // Escape should fully reset the state
      expect(quickSearch.state.isQuestionMode).toBe(false);
      expect(quickSearch.state.value).toBe('');
    });

    it('should focus input when AI button clicked with no text (hint to type)', () => {
      // When already in question mode but no text, clicking button focuses input
      const quickSearch = createQuickSearch('treatment');
      quickSearch.setState({ isQuestionMode: true, value: '' });
      renderQuickSearch(quickSearch);

      const aiButton = screen.getByRole('button', { name: /ask the grafana assistant/i });
      fireEvent.click(aiButton);

      // Should NOT call openQuickSearchAssistant (no text to submit)
      expect(mockOpenQuickSearchAssistant).not.toHaveBeenCalled();
      // Should remain in question mode
      expect(quickSearch.state.isQuestionMode).toBe(true);
    });
  });
});
